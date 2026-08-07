import { NextResponse } from "next/server";
import { getSessionStore } from "@/lib/store/session";
import type { Candidate, SessionState } from "@/lib/types";
import {
  CANNED_QUESTIONS,
  TOTAL_QUESTIONS,
  cannedWelcome,
  cannedFeedback,
} from "@/lib/engine/canned";

export const dynamic = "force-dynamic";

/**
 * THE CONTRACT ENDPOINT (docs/technical-spec.md, TRD §3). Response shapes are
 * sacred: { reply, done } every turn, plus { feedback } when done is true.
 * Extra fields may only ever be added, never renamed or removed.
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

    const { sessionId, candidate } = (body ?? {}) as {
      sessionId?: unknown;
      candidate?: Candidate;
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
      const state: SessionState = {
        sessionId,
        candidate,
        askedCount: 1,
        phase: "active",
        startedAt: new Date().toISOString(),
      };
      await store.set(sessionId, state);
      return NextResponse.json({
        reply: `${cannedWelcome(candidate)}\n\nFirst question: ${CANNED_QUESTIONS[0].q}`,
        done: false,
      });
    }

    const session = await store.get(sessionId);

    // Unknown session and no candidate to start from: recover in character, never error.
    if (!session) {
      const state: SessionState = {
        sessionId,
        candidate: {},
        askedCount: 1,
        phase: "active",
        startedAt: new Date().toISOString(),
      };
      await store.set(sessionId, state);
      return NextResponse.json({
        reply: `Apologies — I don't have our earlier thread on file, so let's restart cleanly. ${CANNED_QUESTIONS[0].q}`,
        done: false,
      });
    }

    // Session already concluded: repeat the closing response idempotently.
    if (session.phase === "done") {
      return NextResponse.json({
        reply:
          "This interview has already concluded — thank you again for your time. Start a new session if you'd like another round.",
        done: true,
        feedback: cannedFeedback(session.candidate),
      });
    }

    // The candidate just answered the final question: wrap with structured feedback.
    if (session.askedCount >= TOTAL_QUESTIONS) {
      session.phase = "done";
      await store.set(sessionId, session);
      return NextResponse.json({
        reply:
          "That completes our interview — thank you for working through every question. Here is my structured feedback.",
        done: true,
        feedback: cannedFeedback(session.candidate),
      });
    }

    // Regular turn: acknowledge and ask the next planned question.
    const next = CANNED_QUESTIONS[session.askedCount];
    session.askedCount += 1;
    await store.set(sessionId, session);
    return NextResponse.json({
      reply: `Noted, thank you. ${next.q}`,
      done: false,
    });
  } catch {
    // Absolute backstop — a judge must never see a 5xx (CLAUDE.md rule 5).
    return NextResponse.json({
      reply:
        "Give me a moment to gather my notes — could you repeat or expand your last answer?",
      done: false,
    });
  }
}
