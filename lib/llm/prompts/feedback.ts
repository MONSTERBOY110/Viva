import type { SessionState } from "@/lib/types";

/** Feedback prompts (TRD §5.3): one call over the full turn history. */

export const FEEDBACK_SYSTEM = `You are Viva, a technical interviewer writing the final structured report for a 31-day AI cohort candidate.
Rules:
- summary: 2–3 sentences, specific to THIS interview — mention the strongest moment and the clearest gap.
- strengths / gaps: concise, concrete items. Every item must be traceable to something the candidate actually said.
- next: specific study actions naming curriculum days, e.g. "Revisit Day 20 (Conversation Memory) — rebuild the summarizer without a framework."
- evidenceMap: for EVERY strength and gap item, one entry quoting the candidate's own words (short, verbatim from their answers) and the curriculum day it relates to.
- Tone: honest, kind, useful. No filler praise, no cruelty. Write for the candidate.`;

export function feedbackPrompt(state: SessionState): string {
  const turns = state.turns ?? [];
  const plan = state.plan;
  const sections: string[] = [];

  sections.push(
    `CANDIDATE: ${state.candidate.member?.name ?? "custom candidate"} (${state.candidate.member?.jobRole ?? "unknown role"})`,
  );
  if (plan) sections.push(`PERSONA NOTES: ${plan.personaNotes}`);
  if ((state.priorMemories ?? []).length > 0) {
    sections.push(
      "MEMORY FROM PREVIOUS INTERVIEWS (if a past gap improved or persisted, say so explicitly in the summary):",
      ...state.priorMemories!.map((m) => `- ${m}`),
    );
  }
  if (state.confidence && Object.keys(state.confidence).length > 0) {
    sections.push(
      "MODULE CONFIDENCE: " +
        Object.entries(state.confidence)
          .map(([m, c]) => `${m}: ${c.toFixed(2)}`)
          .join(" · "),
    );
  }

  sections.push("", "FULL INTERVIEW TRANSCRIPT:");
  turns.forEach((t, i) => {
    sections.push(
      `Q${i + 1} (Day ${t.day}, L${t.difficulty}): ${t.q}`,
      `A: ${t.a ?? "(no answer)"}`,
      t.eval
        ? `eval: ${t.eval.score.toFixed(2)} ${t.eval.classification} — "${t.eval.evidence}"`
        : "eval: n/a",
      "",
    );
  });

  sections.push("Write the final structured report now.");
  return sections.join("\n");
}
