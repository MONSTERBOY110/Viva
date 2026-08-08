import curriculum from "@/lib/data/curriculum.json";
import { generateStructured, llmAvailable } from "@/lib/llm/gemini";
import { PLANNER_SYSTEM, plannerPrompt } from "@/lib/llm/prompts/planner";
import { PlanPolishSchema } from "@/lib/llm/schemas";
import type { Candidate, InterviewPlan } from "@/lib/types";
import { isFirstTryStrongSignals, pickTopics, type CurriculumModule } from "./policy";

/**
 * Planner (TRD §5.1): deterministic topic selection in policy.ts, then one
 * best-effort LLM call to write personaNotes + vivid reasonDetail lines.
 * The plan is fully functional without the LLM, prose just gets plainer.
 */
export async function buildPlan(
  candidate: Candidate,
  priorMemories: string[] = [],
): Promise<InterviewPlan> {
  const modules = curriculum.modules as CurriculumModule[];
  const topics = pickTopics(candidate, modules);
  const plan: InterviewPlan = {
    candidateId: candidate.member?.id ?? "custom",
    topics,
    personaNotes: defaultPersonaNotes(candidate),
  };

  if (llmAvailable()) {
    try {
      const polish = await generateStructured(PlanPolishSchema, {
        system: PLANNER_SYSTEM,
        prompt: plannerPrompt(candidate, topics, priorMemories),
        temperature: 0.8,
      });
      plan.personaNotes = polish.personaNotes;
      for (const detail of polish.topicDetails) {
        const topic = plan.topics.find((t) => t.day === detail.day);
        if (topic && detail.reasonDetail.trim()) {
          topic.reasonDetail = detail.reasonDetail.trim();
        }
      }
    } catch {
      // Deterministic plan stands on its own, never block the interview on polish.
    }
  }

  return plan;
}

function defaultPersonaNotes(candidate: Candidate): string {
  const role = candidate.member?.jobRole?.trim();
  const years = candidate.member?.yearsExperience;
  const strong = isFirstTryStrongSignals(candidate);
  const who = role
    ? `${role}${typeof years === "number" ? ` with ${years}y experience` : ""}`
    : "candidate with an unspecified background";
  return strong
    ? `${who}, respect the experience, verify depth, escalate quickly on strong answers`
    : `${who}, encouraging tone, probe fundamentals gently, credit progress`;
}
