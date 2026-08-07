import type { Candidate, PlannedTopic } from "@/lib/types";

/**
 * Planner prompts (TRD §5.1). The deterministic engine picks WHAT to probe;
 * the LLM writes WHY in vivid, candidate-specific prose for the Brain panel.
 */

export const PLANNER_SYSTEM = `You are the planning half of Viva, an AI technical interviewer for a 31-day AI engineering cohort.
You receive a candidate profile (role, experience, mission history with attempts/skips) and a pre-selected list of interview topics.
Your job:
1. personaNotes — one sharp line on how the interviewer should treat THIS candidate (tone, what to respect, what to push on).
2. topicDetails — for each topic day, one vivid line explaining why it was chosen for THIS candidate, citing their actual history (attempts, skips, first-try passes).
Be specific and human. Never invent history that isn't in the profile.`;

export function plannerPrompt(candidate: Candidate, topics: PlannedTopic[]): string {
  return [
    "CANDIDATE PROFILE:",
    JSON.stringify(candidate, null, 2),
    "",
    "PRE-SELECTED TOPICS (day, module, selection reason, detail):",
    ...topics.map(
      (t) =>
        `- Day ${t.day} · ${t.module} · ${t.reason} · ${t.reasonDetail} · starts at L${t.startDifficulty}`,
    ),
    "",
    "Write personaNotes and one reasonDetail line per topic day.",
  ].join("\n");
}
