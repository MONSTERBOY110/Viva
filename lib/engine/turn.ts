import { generateStructured } from "@/lib/llm/gemini";
import { TURN_SYSTEM, turnPrompt } from "@/lib/llm/prompts/turn";
import { TurnOutputSchema, type TurnOutput } from "@/lib/llm/schemas";
import type { SessionState, TurnEval } from "@/lib/types";
import curriculum from "@/lib/data/curriculum.json";
import {
  applyGuardrails,
  computeDirectives,
  distinctDays,
  moduleForDay,
  pickUncoveredDay,
  updateConfidence,
  type CurriculumModule,
} from "./policy";
import { dayTitle, seedQuestion } from "./questions";

const modules = curriculum.modules as CurriculumModule[];

export type TurnResult = {
  state: SessionState;
  reply: string;
  /** True when the interview should wrap — the route generates feedback next. */
  wrap: boolean;
};

/**
 * One interview turn (TRD §5.2): record the answer, evaluate + decide + draft
 * in a single structured LLM call (with policy directives injected), enforce
 * guardrails on the result, and advance the session state. Falls back to a
 * deterministic path when the LLM chain is exhausted — the interview always
 * moves forward.
 */
export async function runTurn(
  state: SessionState,
  message: string,
): Promise<TurnResult> {
  const turns = state.turns ?? [];
  const current = turns.at(-1);
  if (current && current.a === undefined) {
    current.a = message;
  }

  const directives = computeDirectives(state);
  let out: TurnOutput;
  let offline = false;
  try {
    out = await generateStructured(TurnOutputSchema, {
      system: TURN_SYSTEM,
      prompt: turnPrompt(state, message, directives),
      temperature: 0.7,
    });
  } catch {
    offline = true;
    out = offlineTurnOutput(state, message);
  }

  // Score the just-answered question and fold it into module confidence.
  if (current) {
    current.eval = out.evaluation as TurnEval;
    const moduleTitle = moduleForDay(current.day, modules);
    state.confidence = updateConfidence(
      state.confidence ?? {},
      moduleTitle,
      out.evaluation.score,
    );
  }

  const guarded = applyGuardrails(
    { action: out.action, nextDay: out.nextDay, nextDifficulty: out.nextDifficulty },
    state,
  );

  if (guarded.action === "wrap") {
    state.phase = "wrapping";
    state.coverage = distinctDays(turns);
    const closing =
      !offline && out.action === "wrap"
        ? out.reply
        : "That gives me a complete picture — thank you for working through all of it with me. Let me put together your feedback.";
    return { state, reply: closing, wrap: true };
  }

  // If policy redirected the move, the model's drafted reply no longer fits.
  const redirected = guarded.action !== out.action || guarded.nextDay !== out.nextDay;
  const reply =
    redirected || offline
      ? transitionReply(state, guarded.nextDay, out)
      : out.reply;

  const rationale =
    guarded.forced.length > 0
      ? `${out.rationale} [policy: ${guarded.forced.join("; ")}]`
      : out.rationale;

  turns.push({
    q: reply,
    day: guarded.nextDay,
    difficulty: guarded.nextDifficulty,
    rationale,
  });
  state.turns = turns;
  state.askedCount = turns.length;
  state.coverage = distinctDays(turns);

  return { state, reply, wrap: false };
}

/** A graceful topic-change line + deterministic seed question for the target day. */
function transitionReply(
  state: SessionState,
  day: number,
  out: TurnOutput,
): string {
  const ack =
    out.evaluation.classification === "dont-know"
      ? "No problem at all — knowing the edges of your knowledge is a skill too."
      : out.evaluation.classification === "strong"
        ? "Good answer."
        : "Alright, noted.";
  return `${ack} Let's change tracks to ${dayTitle(day)}. ${seedQuestion(day)}`;
}

/**
 * Deterministic stand-in for the structured call when the LLM chain is down:
 * crude-but-fair heuristic evaluation, and a policy-guided next move.
 */
function offlineTurnOutput(state: SessionState, message: string): TurnOutput {
  const text = message.trim().toLowerCase();
  const dontKnow =
    /\b(don'?t know|no idea|not sure|can'?t answer|skip)\b/.test(text);
  const evaluation = dontKnow
    ? { score: 0, classification: "dont-know" as const, evidence: message.slice(0, 80) }
    : text.length < 40
      ? { score: 0.25, classification: "weak" as const, evidence: message.slice(0, 80) }
      : { score: 0.5, classification: "partial" as const, evidence: message.slice(0, 80) };

  const asked = (state.turns ?? []).length;
  const nextDay = pickUncoveredDay(state);
  return {
    evaluation,
    action: asked >= 12 ? "wrap" : "switch",
    nextDay,
    nextDifficulty: 1,
    rationale: "LLM unavailable — deterministic fallback kept the interview moving",
    reply: seedQuestion(nextDay),
  };
}
