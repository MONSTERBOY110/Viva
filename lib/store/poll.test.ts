import { describe, it, expect, beforeEach } from "vitest";
import { getPollStore, newPollId, type PollStore } from "./poll";

/**
 * Exercises the in-memory store, which is the same contract the Redis store
 * implements. Env vars are absent under vitest, so getPollStore() yields the
 * memory backend; reset the globalThis singleton between tests.
 */

const g = globalThis as typeof globalThis & { __sohPollStore?: PollStore };

describe("poll store", () => {
  beforeEach(() => {
    delete g.__sohPollStore;
  });

  it("creates a poll and reads it back with zeroed tallies", async () => {
    const store = getPollStore();
    const poll = await store.create("Best debugging tool?", ["print", "debugger", "prayer"]);
    expect(poll.id).toMatch(/^[a-z2-9]{6}$/);
    expect(poll.creatorToken).toBeTruthy();
    expect(poll.closedAt).toBeNull();

    const view = await store.get(poll.id);
    expect(view).not.toBeNull();
    expect(view!.question).toBe("Best debugging tool?");
    expect(view!.tallies).toEqual([0, 0, 0]);
    expect(view!.total).toBe(0);
    // creator's secret never leaves the store on the read path
    expect(view).not.toHaveProperty("creatorToken");
  });

  it("returns null for an unknown id", async () => {
    expect(await getPollStore().get("zzzzzz")).toBeNull();
  });

  it("counts a vote and rejects the same voter token on repeat", async () => {
    const store = getPollStore();
    const poll = await store.create("Tabs or spaces?", ["tabs", "spaces", "both"]);

    const first = await store.vote(poll.id, "voter-a", 1);
    expect(first).toEqual({ outcome: "ok", tallies: [0, 1, 0], total: 1 });

    const repeat = await store.vote(poll.id, "voter-a", 0);
    expect(repeat.outcome).toBe("already_voted");
    if (repeat.outcome !== "not_found") {
      expect(repeat.tallies).toEqual([0, 1, 0]);
      expect(repeat.total).toBe(1);
    }

    const other = await store.vote(poll.id, "voter-b", 1);
    expect(other).toEqual({ outcome: "ok", tallies: [0, 2, 0], total: 2 });
  });

  it("rejects out-of-range and non-integer option indexes", async () => {
    const store = getPollStore();
    const poll = await store.create("Pick one", ["a", "b", "c"]);
    expect((await store.vote(poll.id, "v", 3)).outcome).toBe("bad_option");
    expect((await store.vote(poll.id, "v", -1)).outcome).toBe("bad_option");
    expect((await store.vote(poll.id, "v", 1.5)).outcome).toBe("bad_option");
    const view = await store.get(poll.id);
    expect(view!.total).toBe(0);
  });

  it("votes on a missing poll report not_found", async () => {
    expect((await getPollStore().vote("zzzzzz", "v", 0)).outcome).toBe("not_found");
  });

  it("close requires the creator token and then rejects votes", async () => {
    const store = getPollStore();
    const poll = await store.create("Close me", ["yes", "no", "maybe"]);

    expect(await store.close(poll.id, "wrong-token")).toBe("forbidden");
    expect(await store.close("zzzzzz", poll.creatorToken)).toBe("not_found");
    expect(await store.close(poll.id, poll.creatorToken)).toBe("ok");

    const view = await store.get(poll.id);
    expect(view!.closedAt).not.toBeNull();

    const vote = await store.vote(poll.id, "late-voter", 0);
    expect(vote.outcome).toBe("closed");
    // closing twice stays ok and keeps the original closedAt semantics
    expect(await store.close(poll.id, poll.creatorToken)).toBe("ok");
  });

  it("counts watchers via heartbeat and not plain reads", async () => {
    const store = getPollStore();
    const poll = await store.create("Who's watching?", ["me", "you", "them"]);
    await store.get(poll.id, "watcher-1");
    await store.get(poll.id, "watcher-2");
    const view = await store.get(poll.id);
    expect(view!.watching).toBe(2);
  });

  it("generates ids from the unambiguous alphabet", () => {
    for (let i = 0; i < 50; i++) {
      expect(newPollId()).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{6}$/);
    }
  });
});
