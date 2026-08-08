import { NextResponse, after } from "next/server";
import { generateReport } from "@/lib/engine/feedback";
import { buildPlan } from "@/lib/engine/planner";
import { seedQuestion } from "@/lib/engine/questions";
import { runTurn } from "@/lib/engine/turn";
import { recallCandidateMemories, writeInterviewMemory } from "@/lib/store/breeth";
import { getSessionStore } from "@/lib/store/session";
import type { Candidate, SessionState } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * THE CONTRACT ENDPOINT (docs/technical-spec.md, TRD §3). Response shapes are
 * sacred: { reply, done } every turn, plus { feedback } when done is true.
 * Extra fields may only ever be added, never renamed or removed.
 *
 * Engine flow (TRD §5): start → plan from the candidate's journey; each turn →
 * one structured LLM call guarded by deterministic policy; wrap → evidence-
 * linked report. Every stage has a deterministic fallback, so the interview
 * completes even with the LLM chain down.
 *
 * Defensive paths (never 5xx to a judge):
 *  - malformed / non-JSON body        → 400 with a JSON error message
 *  - unknown sessionId, no candidate  → 200, polite in-character restart
 *  - anything unexpected              → 200, graceful interviewer line
 */
export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON: { sessionId, candidate? , message? }." },
        { status: 400 },
      );
    }

    const { sessionId, candidate, message } = (body ?? {}) as {
      sessionId?: unknown;
      candidate?: Candidate;
      message?: unknown;
    };

    if (typeof sessionId !== "string" || sessionId.trim() === "") {
      return NextResponse.json(
        { error: "A non-empty string sessionId is required." },
        { status: 400 },
      );
    }

    const store = getSessionStore();

    // Start (or explicit restart): the request carries a candidate object.
    if (candidate && typeof candidate === "object") {
      const state = await startSession(sessionId, candidate);
      await store.set(sessionId, state);
      return NextResponse.json({ reply: openingReply(state), done: false });
    }

    let session = await store.get(sessionId);

    // Unknown session and no candidate to start from: recover in character.
    if (!session) {
      session = await startSession(sessionId, {});
      await store.set(sessionId, session);
      return NextResponse.json({
        reply: `Apologies, I don't have our earlier thread on file, so let's restart cleanly. ${session.turns![0].q}`,
        done: false,
      });
    }

    // Session already concluded: repeat the closing response idempotently.
    if (session.phase === "done" && session.report) {
      return NextResponse.json({
        reply:
          "This interview has already concluded, thank you again for your time. Start a new session if you'd like another round.",
        done: true,
        feedback: session.report.feedback,
      });
    }

    // Regular turn: evaluate the answer, decide, ask, or wrap with the report.
    const result = await runTurn(session, coerceMessage(message));

    if (result.wrap) {
      const report = await generateReport(result.state);
      result.state.phase = "done";
      result.state.report = report;
      await store.set(sessionId, result.state);
      // Long-term memory write happens after the response is sent (Breeth, TRD §6).
      const finished = result.state;
      after(() => writeInterviewMemory(finished));
      return NextResponse.json({
        reply: result.reply,
        done: true,
        feedback: report.feedback,
      });
    }

    await store.set(sessionId, result.state);
    return NextResponse.json({ reply: result.reply, done: false });
  } catch {
    // Absolute backstop, a judge must never see a 5xx (CLAUDE.md rule 5).
    return NextResponse.json({
      reply:
        "Give me a moment to gather my notes, could you repeat or expand your last answer?",
      done: false,
    });
  }
}

/** Build the plan and seed the first question from its highest-priority topic. */
async function startSession(
  sessionId: string,
  candidate: Candidate,
): Promise<SessionState> {
  const priorMemories = await recallCandidateMemories(candidate.member?.id);
  const plan = await buildPlan(candidate, priorMemories);
  const first = plan.topics[0];
  return {
    sessionId,
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
        rationale: `opening probe (${first.reason}): ${first.reasonDetail}`,
      },
    ],
    coverage: [first.day],
    confidence: {},
    priorMemories,
  };
}

/** The 30-second test (PRD §6): the welcome proves we read their journey. */
function openingReply(state: SessionState): string {
  const name = state.candidate.member?.name?.trim();
  const first = state.plan!.topics[0];
  const greeting = name ? `Welcome, ${name}` : "Welcome";
  const reason = first.reasonDetail
    .trim()
    .replace(/^we'?ll start where it matters most:?\s*/i, "")
    .replace(/[.!]+$/, "");
  const continuity =
    (state.priorMemories ?? []).length > 0
      ? " I also remember our previous conversation, I'll be checking how far you've come since."
      : "";
  return (
    `${greeting}, I'm Viva, your technical interviewer. I've been through your 31-day journey, ` +
    `and I've planned our conversation around it.${continuity} We'll start where it matters most: ${reason}.` +
    `\n\n${state.turns![0].q}`
  );
}

function coerceMessage(message: unknown): string {
  if (typeof message === "string" && message.trim()) return message.trim();
  return "(the candidate sent an empty message)";
}
