import type { Candidate, PlannedTopic } from "@/lib/types";

/**
 * Planner prompts (TRD §5.1). The deterministic engine picks WHAT to probe;
 * the LLM writes WHY in vivid, candidate-specific prose for the Brain panel.
 */

export const PLANNER_SYSTEM = `You are the planning half of Viva, an AI technical interviewer for a 31-day AI engineering cohort.
You receive a candidate profile (role, experience, mission history with attempts/skips) and a pre-selected list of interview topics.
Your job:
1. personaNotes, one sharp line on how the interviewer should treat THIS candidate (tone, what to respect, what to push on).
2. topicDetails, for each topic day, one vivid line explaining why it was chosen for THIS candidate, citing their actual history (attempts, skips, first-try passes).

reasonDetail rules: address the candidate directly as "you"; a short clause only, NO trailing period, NO sentence stem, never include words like "We'll start" or restate the question. Good example: "you needed 5 attempts to crack Vector Databases on Day 8". Bad: "We'll start where it matters most: you needed…".
Be specific and human. Never invent history that isn't in the profile.

PUNCTUATION: never use an em dash or an en dash. Use a comma, a colon, parentheses, or a second sentence instead. Ordinary hyphens in compound words are fine.`;

export function plannerPrompt(
  candidate: Candidate,
  topics: PlannedTopic[],
  priorMemories: string[] = [],
): string {
  const sections = [
    "CANDIDATE PROFILE:",
    JSON.stringify(candidate, null, 2),
    "",
    "PRE-SELECTED TOPICS (day, module, selection reason, detail):",
    ...topics.map(
      (t) =>
        `- Day ${t.day} · ${t.module} · ${t.reason} · ${t.reasonDetail} · starts at L${t.startDifficulty}`,
    ),
  ];
  if (priorMemories.length > 0) {
    sections.push(
      "",
      "MEMORY FROM PREVIOUS INTERVIEWS (weave continuity into personaNotes, e.g. what to re-check):",
      ...priorMemories.map((m) => `- ${m}`),
    );
  }
  sections.push("", "Write personaNotes and one reasonDetail line per topic day.");
  return sections.join("\n");
}
