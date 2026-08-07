import curriculum from "@/lib/data/curriculum.json";
import { CANNED_QUESTIONS } from "./canned";

type CurriculumDay = { day: number; title: string; objectives?: string[] };

const DAYS = (curriculum.days ?? []) as CurriculumDay[];

export function dayTitle(day: number): string {
  return DAYS.find((d) => d.day === day)?.title ?? `Day ${day}`;
}

/**
 * Deterministic seed question for a curriculum day — used when the LLM is
 * unavailable or when policy overrides the model's chosen topic and its
 * drafted reply no longer fits. Hand-written bank first, curriculum-derived
 * generic second. Never fails.
 */
export function seedQuestion(day: number): string {
  const canned = CANNED_QUESTIONS.find((q) => q.day === day);
  if (canned) return canned.q;
  const title = dayTitle(day);
  return `Let's talk about ${title} (Day ${day}): walk me through how you approached it in the cohort — what you built, and the one part that made you think hardest.`;
}
