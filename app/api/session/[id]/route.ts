import { NextResponse } from "next/server";
import { getSessionStore } from "@/lib/store/session";
import { moduleTitleFor } from "@/lib/journey";
import { MIN_DISTINCT_DAYS } from "@/lib/engine/policy";

export const dynamic = "force-dynamic";

/**
 * Internal read model for the Interviewer Mind panel (TRD section 7).
 * Deliberately separate from POST /api/interview so the judge-facing contract
 * response stays exactly the shape technical-spec.md defines.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getSessionStore().get(id);

    if (!session) {
      return NextResponse.json({ found: false }, { status: 404 });
    }

    const turns = session.turns ?? [];
    const answered = turns.filter((t) => t.a !== undefined);
    const current = turns.at(-1);
    const coverage = [...new Set(turns.map((t) => t.day))];
    const plannedDays = session.plan?.topics.map((t) => t.day) ?? [];

    return NextResponse.json({
      found: true,
      phase: session.phase,
      candidate: session.candidate,
      plan: session.plan ?? null,
      priorMemories: session.priorMemories ?? [],
      current: current
        ? {
            day: current.day,
            module: moduleTitleFor(current.day),
            difficulty: current.difficulty,
            rationale: current.rationale,
            question: current.q,
          }
        : null,
      /** Rationale history, newest last. This is the Mind panel's reasoning feed. */
      reasoning: turns.map((t) => ({
        day: t.day,
        module: moduleTitleFor(t.day),
        difficulty: t.difficulty,
        rationale: t.rationale,
        evaluation: t.eval ?? null,
      })),
      coverage: {
        days: coverage,
        distinct: coverage.length,
        required: MIN_DISTINCT_DAYS,
        planned: plannedDays,
      },
      confidence: session.confidence ?? {},
      counts: {
        asked: turns.length,
        answered: answered.length,
      },
      report: session.report ?? null,
    });
  } catch {
    return NextResponse.json(
      { found: false, error: "unavailable" },
      { status: 200 },
    );
  }
}
