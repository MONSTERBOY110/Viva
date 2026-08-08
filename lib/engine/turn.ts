import { generateStructured } from "@/lib/llm/gemini";
import { TURN_SYSTEM, turnPrompt } from "@/lib/llm/prompts/turn";
import { TurnOutputSchema, type TurnOutput } from "@/lib/llm/schemas";
import type { AnswerTelemetry, SessionState, Steer, TurnEval } from "@/lib/types";
import curriculum from "@/lib/data/curriculum.json";
import {
  applyGuardrails,
  computeDirectives,
  distinctDays,
  moduleForDay,
  pickUncoveredDay,
  steerDirective,
  updateConfidence,
  type CurriculumModule,
} from "./policy";
import { dayTitle, seedQuestion } from "./questions";

const modules = curriculum.modules as CurriculumModule[];

export type TurnResult = {
  state: SessionState;
  reply: string;
  /** True when the interview should wrap, the route generates feedback next. */
  wrap: boolean;
};

/**
 * One interview turn (TRD §5.2): record the answer, evaluate + decide + draft
 * in a single structured LLM call (with policy directives injected), enforce
 * guardrails on the result, and advance the session state. Falls back to a
 * deterministic path when the LLM chain is exhausted, the interview always
 * moves forward.
 */
export async function runTurn(
  state: SessionState,
  message: string,
  telemetry?: AnswerTelemetry,
): Promise<TurnResult> {
  const turns = state.turns ?? [];
  const current = turns.at(-1);
  if (current && current.a === undefined) {
    current.a = message;
    if (telemetry) current.telemetry = telemetry;
  }

  // An observer's steer joins the policy directives for this turn only, then
  // is consumed. The guardrails below still run, so a steer can shape the
  // interview but never take it below the contract minimums.
  const steer = state.pendingSteer;
  const directives = computeDirectives(state);
  if (steer) {
    directives.unshift(steerDirective(steer));
    state.pendingSteer = undefined;
    state.steerLog = [...(state.steerLog ?? []), steer];
  }

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
    out = offlineTurnOutput(state, message, steer);
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
        : "That gives me a complete picture, thank you for working through all of it with me. Let me put together your feedback.";
    return { state, reply: closing, wrap: true };
  }

  // If policy redirected the move, the model's drafted reply no longer fits.
  const redirected = guarded.action !== out.action || guarded.nextDay !== out.nextDay;
  const reply =
    redirected || offline
      ? transitionReply(state, guarded.nextDay, out)
      : out.reply;

  // The panel shows the whole chain of custody for this question: what the
  // model decided, what an observer asked for, and what policy overruled.
  const parts = [out.rationale];
  if (steer) parts.push(`[steered by observer: ${steerLabel(steer)}]`);
  if (guarded.forced.length > 0) {
    parts.push(`[policy: ${guarded.forced.join("; ")}]`);
  }

  turns.push({
    q: reply,
    day: guarded.nextDay,
    difficulty: guarded.nextDifficulty,
    rationale: parts.join(" "),
    steeredBy: steer?.kind,
  });
  state.turns = turns;
  state.askedCount = turns.length;
  state.coverage = distinctDays(turns);

  return { state, reply, wrap: false };
}

function steerLabel(steer: Steer): string {
  return steer.kind === "day" ? `go to Day ${steer.day}` : steer.kind;
}

/** A graceful topic-change line + deterministic seed question for the target day. */
function transitionReply(
  state: SessionState,
  day: number,
  out: TurnOutput,
): string {
  const ack =
    out.evaluation.classification === "dont-know"
      ? "No problem at all, knowing the edges of your knowledge is a skill too."
      : out.evaluation.classification === "strong"
        ? "Good answer."
        : "Alright, noted.";
  return `${ack} Let's change tracks to ${dayTitle(day)}. ${seedQuestion(day)}`;
}

/**
 * Deterministic stand-in for the structured call when the LLM chain is down:
 * crude-but-fair heuristic evaluation, and a policy-guided next move.
 */
function offlineTurnOutput(
  state: SessionState,
  message: string,
  steer?: Steer,
): TurnOutput {
  const text = message.trim().toLowerCase();
  const dontKnow =
    /\b(don'?t know|no idea|not sure|can'?t answer|skip)\b/.test(text);
  const evaluation = dontKnow
    ? { score: 0, classification: "dont-know" as const, evidence: message.slice(0, 80) }
    : text.length < 40
      ? { score: 0.25, classification: "weak" as const, evidence: message.slice(0, 80) }
      : { score: 0.5, classification: "partial" as const, evidence: message.slice(0, 80) };

  const asked = (state.turns ?? []).length;
  const lastDay = state.turns?.at(-1)?.day;
  const lastDifficulty = state.turns?.at(-1)?.difficulty ?? 1;

  // Steering still works with the model chain down, it just resolves through
  // plain rules instead of prose.
  let action: TurnOutput["action"] = asked >= 12 ? "wrap" : "switch";
  let nextDay = pickUncoveredDay(state);
  let nextDifficulty = 1;

  if (steer) {
    if (steer.kind === "day" && steer.day) {
      action = "switch";
      nextDay = steer.day;
    } else if (steer.kind === "harder") {
      action = "escalate";
      nextDay = lastDay ?? nextDay;
      nextDifficulty = Math.min(3, lastDifficulty + 1);
    } else if (steer.kind === "easier") {
      action = "drill";
      nextDay = lastDay ?? nextDay;
      nextDifficulty = Math.max(1, lastDifficulty - 1);
    } else if (steer.kind === "wrap") {
      action = "wrap";
    }
  }

  return {
    evaluation,
    action,
    nextDay,
    nextDifficulty,
    rationale: steer
      ? "observer steer applied by the deterministic path"
      : "LLM unavailable, deterministic fallback kept the interview moving",
    reply: seedQuestion(nextDay),
  };
}
