import curriculum from "@/lib/data/curriculum.json";
import { generateStructured } from "@/lib/llm/gemini";
import { FEEDBACK_SYSTEM, feedbackPrompt } from "@/lib/llm/prompts/feedback";
import { FeedbackOutputSchema, type FeedbackOutput } from "@/lib/llm/schemas";
import type { Feedback, SessionState } from "@/lib/types";
import { moduleForDay, type CurriculumModule } from "./policy";
import { dayTitle } from "./questions";

const modules = curriculum.modules as CurriculumModule[];

export type ReportResult = {
  /** Contract-shaped feedback (technical-spec.md) — exactly these four fields. */
  feedback: Feedback;
  /** Internal: powers the evidence-linked report UI. Stored, never in the contract. */
  evidenceMap: FeedbackOutput["evidenceMap"];
};

/**
 * Final report (TRD §5.3): one LLM call over the whole transcript, validated
 * against the contract shape, with a deterministic evidence-based fallback so
 * the judge always receives real feedback — even with the LLM chain down.
 */
export async function generateReport(state: SessionState): Promise<ReportResult> {
  try {
    const out = await generateStructured(FeedbackOutputSchema, {
      system: FEEDBACK_SYSTEM,
      prompt: feedbackPrompt(state),
      temperature: 0.6,
    });
    return {
      feedback: {
        summary: out.summary,
        strengths: out.strengths,
        gaps: out.gaps,
        next: out.next,
      },
      evidenceMap: out.evidenceMap,
    };
  } catch {
    return deterministicReport(state);
  }
}

/** Evidence-grounded fallback built purely from per-turn evals. */
function deterministicReport(state: SessionState): ReportResult {
  const turns = (state.turns ?? []).filter((t) => t.eval);
  const name = state.candidate.member?.name ?? "The candidate";

  const strongTurns = turns.filter((t) => (t.eval!.score ?? 0) >= 0.7);
  const weakTurns = turns.filter((t) => (t.eval!.score ?? 0) < 0.4);

  const strengths = strongTurns.slice(0, 4).map(
    (t) => `Solid on ${moduleForDay(t.day, modules)} (Day ${t.day}) — "${t.eval!.evidence}"`,
  );
  const gaps = weakTurns.slice(0, 4).map(
    (t) => `Shaky on ${dayTitle(t.day)} (Day ${t.day}) — "${t.eval!.evidence}"`,
  );
  const next = [...new Set(weakTurns.map((t) => t.day))]
    .slice(0, 4)
    .map((d) => `Revisit Day ${d} (${dayTitle(d)}) and redo its mission hands-on.`);

  const evidenceMap = [
    ...strongTurns.slice(0, 4).map((t, i) => ({
      kind: "strength" as const,
      item: strengths[i],
      quote: t.eval!.evidence,
      day: t.day,
    })),
    ...weakTurns.slice(0, 4).map((t, i) => ({
      kind: "gap" as const,
      item: gaps[i],
      quote: t.eval!.evidence,
      day: t.day,
    })),
  ];

  return {
    feedback: {
      summary: `${name} answered ${turns.length} scored questions across ${new Set(turns.map((t) => t.day)).size} curriculum days: ${strongTurns.length} strong, ${weakTurns.length} weak. The detail below links every point to their own answers.`,
      strengths: strengths.length > 0 ? strengths : ["Completed the full interview loop with consistent engagement"],
      gaps: gaps.length > 0 ? gaps : ["No major gaps surfaced in this session"],
      next: next.length > 0 ? next : ["Re-attempt the capstone-adjacent missions (Days 21–24) at a harder difficulty"],
    },
    evidenceMap,
  };
}
