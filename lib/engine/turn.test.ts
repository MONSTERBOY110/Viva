import { beforeAll, describe, expect, it } from "vitest";
import candidatesFile from "@/lib/data/candidates.json";
import type { Candidate, SessionState } from "@/lib/types";
import { generateReport } from "./feedback";
import { buildPlan } from "./planner";
import { HARD_CAP, MIN_DISTINCT_DAYS, MIN_QUESTIONS } from "./policy";
import { seedQuestion } from "./questions";
import { runTurn } from "./turn";

/**
 * Full offline interview simulation: with no GEMINI_API_KEY the engine runs
 * its deterministic fallback end to end. This proves the LLM is an
 * enhancement, not a dependency — the contract minimums hold even with the
 * model chain completely down.
 */

const candidates = candidatesFile.candidates as Candidate[];
const cand004 = candidates.find((c) => c.member?.id === "CAND-004")!;

beforeAll(() => {
  delete process.env.GEMINI_API_KEY;
});

async function startSession(candidate: Candidate): Promise<SessionState> {
  const plan = await buildPlan(candidate);
  const first = plan.topics[0];
  return {
    sessionId: "offline-test",
    candidate,
    askedCount: 1,
    phase: "active",
    startedAt: new Date().toISOString(),
    plan,
    turns: [
      {
        q: seedQuestion(first.day),
        day: first.day,
        difficulty: first.startDifficulty,
        rationale: `opening on ${first.reason}: ${first.reasonDetail}`,
      },
    ],
    coverage: [first.day],
    confidence: {},
  };
}

const ANSWERS = [
  "I think embeddings are vectors that capture meaning so similar things are close together.",
  "I don't know, honestly.",
  "It matches words.",
  "We used Chroma locally, stored chunks with metadata, then queried top-k and passed them to the model in the prompt.",
  "That's a broad topic with many considerations to weigh.",
  "MCP lets a model call tools exposed by a server over a standard protocol.",
];

describe("offline interview simulation (no LLM)", () => {
  it("completes a contract-valid interview within the question window", async () => {
    let state = await startSession(cand004);
    let wraps = false;
    let answers = 0;

    while (!wraps && answers < HARD_CAP + 2) {
      const result = await runTurn(state, ANSWERS[answers % ANSWERS.length]);
      answers++;
      state = result.state;
      expect(result.reply.trim().length).toBeGreaterThan(0);
      wraps = result.wrap;
    }

    expect(wraps).toBe(true);
    const asked = state.turns!.length;
    expect(asked).toBeGreaterThanOrEqual(MIN_QUESTIONS);
    expect(asked).toBeLessThanOrEqual(HARD_CAP);
    expect(new Set(state.turns!.map((t) => t.day)).size).toBeGreaterThanOrEqual(
      MIN_DISTINCT_DAYS,
    );
    expect(state.phase).toBe("wrapping");

    // Every answered turn carries an evaluation with evidence.
    const answered = state.turns!.filter((t) => t.a !== undefined);
    expect(answered.length).toBeGreaterThan(0);
    for (const t of answered) {
      expect(t.eval).toBeDefined();
      expect(t.eval!.score).toBeGreaterThanOrEqual(0);
      expect(t.eval!.score).toBeLessThanOrEqual(1);
    }

    // Confidence tracked per module.
    expect(Object.keys(state.confidence ?? {}).length).toBeGreaterThan(0);
  });

  it("generates a contract-shaped, evidence-linked report offline", async () => {
    let state = await startSession(cand004);
    for (let i = 0; i < HARD_CAP + 2; i++) {
      const result = await runTurn(state, ANSWERS[i % ANSWERS.length]);
      state = result.state;
      if (result.wrap) break;
    }

    const report = await generateReport(state);
    expect(typeof report.feedback.summary).toBe("string");
    expect(report.feedback.summary.length).toBeGreaterThan(20);
    for (const key of ["strengths", "gaps", "next"] as const) {
      expect(Array.isArray(report.feedback[key])).toBe(true);
      expect(report.feedback[key].length).toBeGreaterThan(0);
      expect(report.feedback[key].every((s) => typeof s === "string")).toBe(true);
    }
    expect(Array.isArray(report.evidenceMap)).toBe(true);
  });

  it("planner works without a key: valid plan with persona notes", async () => {
    const plan = await buildPlan(cand004);
    expect(plan.candidateId).toBe("CAND-004");
    expect(plan.topics.length).toBeGreaterThanOrEqual(5);
    expect(plan.personaNotes).toContain("Business Analyst");
  });
});
