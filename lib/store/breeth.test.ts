import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionState } from "@/lib/types";
import {
  breethEnabled,
  recallCandidateMemories,
  writeInterviewMemory,
} from "./breeth";

/**
 * The Breeth integration must be a perfect no-op when disabled or
 * misconfigured — the product is whole without it (TRD §6).
 */

const fakeState: SessionState = {
  sessionId: "s",
  candidate: { member: { id: "CAND-004", name: "David Miller" } },
  askedCount: 8,
  phase: "done",
  startedAt: new Date().toISOString(),
  report: {
    feedback: { summary: "s", strengths: ["a"], gaps: ["b"], next: ["c"] },
  },
};

describe("breeth feature flag", () => {
  const savedEnabled = process.env.BREETH_ENABLED;
  const savedKey = process.env.BREETH_API_KEY;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    process.env.BREETH_ENABLED = savedEnabled;
    process.env.BREETH_API_KEY = savedKey;
    vi.unstubAllGlobals();
  });

  it("disabled when BREETH_ENABLED is not 'true'", () => {
    process.env.BREETH_ENABLED = "false";
    process.env.BREETH_API_KEY = "ck_live_real";
    expect(breethEnabled()).toBe(false);
  });

  it("disabled when the key is missing or a placeholder", () => {
    process.env.BREETH_ENABLED = "true";
    process.env.BREETH_API_KEY = "";
    expect(breethEnabled()).toBe(false);
    process.env.BREETH_API_KEY = "your-breeth-api-key";
    expect(breethEnabled()).toBe(false);
  });

  it("recall returns [] and never calls the network when disabled", async () => {
    process.env.BREETH_ENABLED = "false";
    const memories = await recallCandidateMemories("CAND-004");
    expect(memories).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("recall returns [] without an id even when enabled", async () => {
    process.env.BREETH_ENABLED = "true";
    process.env.BREETH_API_KEY = "ck_live_real";
    const memories = await recallCandidateMemories(undefined);
    expect(memories).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("write is a silent no-op when disabled", async () => {
    process.env.BREETH_ENABLED = "false";
    await expect(writeInterviewMemory(fakeState)).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("network failures never throw", async () => {
    process.env.BREETH_ENABLED = "true";
    process.env.BREETH_API_KEY = "ck_live_real";
    vi.mocked(fetch).mockRejectedValue(new Error("boom"));
    await expect(writeInterviewMemory(fakeState)).resolves.toBeUndefined();
    const memories = await recallCandidateMemories("CAND-004");
    expect(memories).toEqual([]);
  });
});
