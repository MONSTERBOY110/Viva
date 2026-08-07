import { describe, expect, it } from "vitest";
import curriculum from "@/lib/data/curriculum.json";
import candidatesFile from "@/lib/data/candidates.json";
import type { Candidate, SessionState, Turn } from "@/lib/types";
import {
  applyGuardrails,
  computeDirectives,
  distinctDays,
  FORCE_WRAP_AT,
  HARD_CAP,
  MIN_DISTINCT_DAYS,
  MIN_QUESTIONS,
  MIN_TOPICS,
  MAX_TOPICS,
  pickTopics,
  pickUncoveredDay,
  updateConfidence,
  type CurriculumModule,
  type TurnDecision,
} from "./policy";

const modules = curriculum.modules as CurriculumModule[];
const candidates = candidatesFile.candidates as Candidate[];
const byId = (id: string) =>
  candidates.find((c) => c.member?.id === id) as Candidate;

// ---------------------------------------------------------------------------
// pickTopics
// ---------------------------------------------------------------------------

describe("pickTopics", () => {
  it("CAND-001 (Sarah): struggles, skip, and a verify-strength probe", () => {
    const topics = pickTopics(byId("CAND-001"), modules);
    const days = topics.map((t) => t.day);

    expect(topics.length).toBeGreaterThanOrEqual(MIN_TOPICS);
    expect(topics.length).toBeLessThanOrEqual(MAX_TOPICS);
    expect(new Set(days).size).toBe(days.length); // no duplicate days
    expect(new Set(days).size).toBeGreaterThanOrEqual(MIN_DISTINCT_DAYS);

    // 4 attempts on Day 12 → struggled, gentle start
    const d12 = topics.find((t) => t.day === 12);
    expect(d12?.reason).toBe("struggled");
    expect(d12?.startDifficulty).toBe(1);

    // Day 29 was skipped
    expect(topics.find((t) => t.day === 29)?.reason).toBe("skipped");

    // 20/30 first-try → strong → one verify-strength probe at L3
    const verify = topics.find((t) => t.reason === "verify-strength");
    expect(verify).toBeDefined();
    expect(verify?.startDifficulty).toBe(3);
  });

  it("CAND-004 (David, struggler): heavy-attempt topics first, no verify-strength", () => {
    const topics = pickTopics(byId("CAND-004"), modules);

    // 5 attempts on Day 8, 10 and 23 dominate the struggled picks
    const struggledDays = topics
      .filter((t) => t.reason === "struggled")
      .map((t) => t.day);
    expect(struggledDays.length).toBeGreaterThanOrEqual(2);
    expect(struggledDays.some((d) => [8, 10, 23].includes(d))).toBe(true);

    // skipped Docker (Day 28)
    expect(topics.find((t) => t.day === 28)?.reason).toBe("skipped");

    // 6/28 first-try is not "strong" → no verify-strength probe
    expect(topics.every((t) => t.reason !== "verify-strength")).toBe(true);
  });

  it("CAND-010 (Gerald): failed missions outrank everything", () => {
    const topics = pickTopics(byId("CAND-010"), modules);
    const failedPicks = topics.filter((t) =>
      t.reasonDetail.startsWith("did not pass"),
    );
    expect(failedPicks.length).toBe(2);
    // Day 8 failed after 4 attempts — the single highest-signal gap
    expect(failedPicks[0].day).toBe(8);
    expect(failedPicks[0].startDifficulty).toBe(1);
  });

  it("empty custom candidate: falls back to core days, still a valid plan", () => {
    const topics = pickTopics({}, modules);
    expect(topics.length).toBeGreaterThanOrEqual(MIN_TOPICS);
    expect(new Set(topics.map((t) => t.day)).size).toBeGreaterThanOrEqual(
      MIN_DISTINCT_DAYS,
    );
    expect(topics.every((t) => t.reason === "core")).toBe(true);
  });

  it("garbage missions array: ignored without crashing", () => {
    const junk = {
      missions: [null, "nonsense", { title: "no day field" }, { day: "12" }],
    } as unknown as Candidate;
    const topics = pickTopics(junk, modules);
    expect(topics.length).toBeGreaterThanOrEqual(MIN_TOPICS);
  });

  it("modules resolve to real curriculum module titles", () => {
    const topics = pickTopics(byId("CAND-001"), modules);
    for (const t of topics) {
      expect(t.module).not.toBe("General");
    }
  });
});

// ---------------------------------------------------------------------------
// applyGuardrails
// ---------------------------------------------------------------------------

function makeTurn(day: number, over: Partial<Turn> = {}): Turn {
  return { q: `q-day-${day}`, day, difficulty: 2, rationale: "test", ...over };
}

function makeState(turns: Turn[], over: Partial<SessionState> = {}): SessionState {
  return {
    sessionId: "s",
    candidate: byId("CAND-001"),
    askedCount: turns.length,
    phase: "active",
    startedAt: new Date().toISOString(),
    plan: {
      candidateId: "CAND-001",
      personaNotes: "test",
      topics: pickTopics(byId("CAND-001"), modules),
    },
    turns,
    ...over,
  };
}

const proposal = (over: Partial<TurnDecision> = {}): TurnDecision => ({
  action: "drill",
  nextDay: 12,
  nextDifficulty: 2,
  ...over,
});

describe("applyGuardrails", () => {
  it("forces wrap at the hard cap regardless of proposal", () => {
    const turns = Array.from({ length: HARD_CAP }, (_, i) => makeTurn((i % 5) + 7));
    const out = applyGuardrails(proposal({ action: "escalate" }), makeState(turns));
    expect(out.action).toBe("wrap");
    expect(out.forced.length).toBeGreaterThan(0);
  });

  it("forces wrap in the wrap window when coverage is satisfied", () => {
    const turns = Array.from({ length: FORCE_WRAP_AT }, (_, i) =>
      makeTurn([7, 8, 11, 12, 22][i % 5]),
    );
    const out = applyGuardrails(proposal(), makeState(turns));
    expect(out.action).toBe("wrap");
  });

  it("rescues coverage instead of wrapping when days < 4 late in the interview", () => {
    const turns = Array.from({ length: FORCE_WRAP_AT }, (_, i) =>
      makeTurn(i % 2 === 0 ? 7 : 8),
    );
    const state = makeState(turns);
    const out = applyGuardrails(proposal({ action: "drill", nextDay: 7 }), state);
    expect(out.action).toBe("switch");
    expect([7, 8]).not.toContain(out.nextDay);
  });

  it("blocks wrap before the 8-question minimum", () => {
    const turns = [makeTurn(7), makeTurn(8), makeTurn(11)];
    const out = applyGuardrails(proposal({ action: "wrap" }), makeState(turns));
    expect(out.action).not.toBe("wrap");
    expect(turns.length).toBeLessThan(MIN_QUESTIONS);
  });

  it("coverage floor: from turn 6 with <4 days, forces a switch to a new day", () => {
    const turns = [7, 7, 8, 8, 7, 8].map((d) => makeTurn(d));
    const out = applyGuardrails(proposal({ action: "drill", nextDay: 8 }), makeState(turns));
    expect(out.action).toBe("switch");
    expect([7, 8]).not.toContain(out.nextDay);
  });

  it("allows the LLM's own switch to satisfy the coverage floor", () => {
    const turns = [7, 7, 8, 8, 7, 8].map((d) => makeTurn(d));
    const out = applyGuardrails(
      proposal({ action: "switch", nextDay: 12 }),
      makeState(turns),
    );
    expect(out.action).toBe("switch");
    expect(out.nextDay).toBe(12);
    expect(out.forced).toHaveLength(0);
  });

  it("never allows 3 consecutive questions on one day", () => {
    const turns = [makeTurn(7), makeTurn(12), makeTurn(12)];
    const out = applyGuardrails(proposal({ action: "drill", nextDay: 12 }), makeState(turns));
    expect(out.action).toBe("switch");
    expect(out.nextDay).not.toBe(12);
  });

  it("dont-know: escalation becomes a kind switch at difficulty 1", () => {
    const turns = [
      makeTurn(7),
      makeTurn(12, {
        eval: { score: 0, classification: "dont-know", evidence: "I don't know" },
      }),
    ];
    const out = applyGuardrails(
      proposal({ action: "escalate", nextDay: 12, nextDifficulty: 3 }),
      makeState(turns),
    );
    expect(out.action).toBe("switch");
    expect(out.nextDifficulty).toBe(1);
  });

  it("blocks difficulty increases after a weak answer", () => {
    const turns = [
      makeTurn(7),
      makeTurn(12, {
        difficulty: 2,
        eval: { score: 0.2, classification: "weak", evidence: "vague" },
      }),
    ];
    const out = applyGuardrails(
      proposal({ action: "switch", nextDay: 22, nextDifficulty: 3 }),
      makeState(turns),
    );
    expect(out.nextDifficulty).toBeLessThanOrEqual(2);
  });

  it("repairs invalid day proposals and clamps difficulty", () => {
    const turns = [makeTurn(7)];
    const out = applyGuardrails(
      proposal({ nextDay: 99, nextDifficulty: 7 as never }),
      makeState(turns),
    );
    expect(out.nextDay).toBeGreaterThanOrEqual(1);
    expect(out.nextDay).toBeLessThanOrEqual(31);
    expect(out.nextDifficulty).toBeLessThanOrEqual(3);
    expect(out.forced.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

describe("helpers", () => {
  it("distinctDays deduplicates", () => {
    expect(distinctDays([makeTurn(7), makeTurn(7), makeTurn(8)])).toEqual([7, 8]);
  });

  it("pickUncoveredDay prefers planned topics not yet covered", () => {
    const state = makeState([makeTurn(12)]);
    const day = pickUncoveredDay(state);
    const plannedDays = state.plan!.topics.map((t) => t.day);
    expect(plannedDays).toContain(day);
    expect(day).not.toBe(12);
  });

  it("updateConfidence: first score sets, later scores average in", () => {
    let c = updateConfidence({}, "Embeddings & Vector Search", 0.8);
    expect(c["Embeddings & Vector Search"]).toBe(0.8);
    c = updateConfidence(c, "Embeddings & Vector Search", 0.2);
    expect(c["Embeddings & Vector Search"]).toBeCloseTo(0.5);
  });
});

// ---------------------------------------------------------------------------
// computeDirectives (pre-call mirror of the guardrails)
// ---------------------------------------------------------------------------

describe("computeDirectives", () => {
  it("demands an immediate wrap at the force-wrap point", () => {
    const turns = Array.from({ length: FORCE_WRAP_AT }, (_, i) =>
      makeTurn([7, 8, 11, 12][i % 4]),
    );
    const d = computeDirectives(makeState(turns));
    expect(d).toHaveLength(1);
    expect(d[0]).toMatch(/wrap.*NOW/i);
  });

  it("forbids early wrap and pushes coverage when days lag", () => {
    const turns = [7, 7, 8, 8, 7].map((day) => makeTurn(day));
    const d = computeDirectives(makeState(turns));
    expect(d.some((x) => /Do NOT wrap/i.test(x))).toBe(true);
    expect(d.some((x) => /Coverage is 2\/4/i.test(x))).toBe(true);
  });

  it("flags two consecutive same-day questions and dont-know kindness", () => {
    const turns = [
      makeTurn(7),
      makeTurn(12),
      makeTurn(12, {
        eval: { score: 0, classification: "dont-know", evidence: "no idea" },
      }),
    ];
    const d = computeDirectives(makeState(turns));
    expect(d.some((x) => /consecutive.*Day 12/i.test(x))).toBe(true);
    expect(d.some((x) => /don't know/i.test(x))).toBe(true);
  });
});
