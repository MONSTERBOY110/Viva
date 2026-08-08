import type {
  Candidate,
  CandidateMission,
  Difficulty,
  PlannedTopic,
  SessionState,
  Steer,
  Turn,
  TurnAction,
} from "@/lib/types";

/**
 * The deterministic brain-stem (TRD §5.1 topic selection, §5.2 guardrails).
 * Pure TypeScript, no LLM calls, fully unit-testable, the LLM proposes,
 * policy disposes. Every override is returned as a human-readable note so the
 * Interviewer Brain panel can show "policy override: …" transparently.
 */

// ---------------------------------------------------------------------------
// Interview shape constants
// ---------------------------------------------------------------------------

export const MIN_QUESTIONS = 8;
export const WRAP_FROM = 10; // LLM may wrap from here
export const FORCE_WRAP_AT = 12; // policy forces wrap from here
export const HARD_CAP = 14; // absolutely no question 15
export const MIN_DISTINCT_DAYS = 4;
export const COVERAGE_CHECK_FROM = 6; // enforce coverage floor from this turn
export const MIN_TOPICS = 5;
export const MAX_TOPICS = 6;

/** The cohort's spine (TRD §5.1): used to fill plans and rescue coverage. */
export const CORE_DAYS: { day: number; title: string }[] = [
  { day: 11, title: "RAG End-to-End & LLM API Basics" },
  { day: 23, title: "Model Context Protocol (MCP)" },
  { day: 22, title: "Multi-Agent Orchestration" },
  { day: 12, title: "Prompt Engineering Fundamentals" },
  { day: 7, title: "Embeddings Explained" },
];

// ---------------------------------------------------------------------------
// Curriculum lookup
// ---------------------------------------------------------------------------

export type CurriculumModule = { n: number; title: string; days: number[] };

export function moduleForDay(day: number, modules: CurriculumModule[]): string {
  const m = modules.find(({ days }) => day >= days[0] && day <= days[1]);
  return m?.title ?? "General";
}

// ---------------------------------------------------------------------------
// Topic selection (runs once, on the start request, TRD §5.1)
// ---------------------------------------------------------------------------

const STRUGGLE_ATTEMPTS = 3; // ≥3 attempts reads as struggle

/** ≥60% first-try passes reads as a genuinely strong run. */
export function isFirstTryStrongSignals(candidate: Candidate): boolean {
  const done = candidate.signals?.missionsCompleted ?? 0;
  const firstTry = candidate.signals?.missionsFirstTry ?? 0;
  return done > 0 && firstTry / done >= 0.6;
}

function validMissions(candidate: Candidate): CandidateMission[] {
  if (!Array.isArray(candidate.missions)) return [];
  return candidate.missions.filter(
    (m): m is CandidateMission =>
      typeof m === "object" && m !== null && typeof m.day === "number",
  );
}

/**
 * Deterministically choose 5-6 interview topics spanning ≥4 distinct days.
 * Priority: failed > struggled (attempts desc) > skipped > verify-strength > core fill.
 * Tolerates any candidate shape, including judge-pasted customs with no missions.
 */
export function pickTopics(
  candidate: Candidate,
  modules: CurriculumModule[],
): PlannedTopic[] {
  const missions = validMissions(candidate);
  const strong = isFirstTryStrongSignals(candidate);
  const topics: PlannedTopic[] = [];
  const usedDays = new Set<number>();

  const add = (t: PlannedTopic) => {
    if (topics.length >= MAX_TOPICS || usedDays.has(t.day)) return;
    usedDays.add(t.day);
    topics.push(t);
  };

  // 1. Outright failures, the highest-signal gaps.
  const failed = missions
    .filter((m) => m.passed === false)
    .sort((a, b) => (b.attempts ?? 0) - (a.attempts ?? 0));
  for (const m of failed.slice(0, 2)) {
    add({
      day: m.day!,
      module: moduleForDay(m.day!, modules),
      reason: "struggled",
      reasonDetail: `did not pass Day ${m.day} (${m.title ?? "mission"}) after ${m.attempts ?? "several"} attempts`,
      startDifficulty: 1,
    });
  }

  // 2. Passed but with visible struggle.
  const struggled = missions
    .filter((m) => m.passed === true && (m.attempts ?? 1) >= STRUGGLE_ATTEMPTS)
    .sort((a, b) => (b.attempts ?? 0) - (a.attempts ?? 0));
  for (const m of struggled.slice(0, 3)) {
    add({
      day: m.day!,
      module: moduleForDay(m.day!, modules),
      reason: "struggled",
      reasonDetail: `${m.attempts} attempts on Day ${m.day} (${m.title ?? "mission"})`,
      startDifficulty: (m.attempts ?? 3) >= 4 ? 1 : 2,
    });
  }

  // 3. Skipped topics, gentle probes; skipping may hide a real gap.
  const skipped = missions.filter((m) => m.skipped === true);
  for (const m of skipped.slice(0, 2)) {
    add({
      day: m.day!,
      module: moduleForDay(m.day!, modules),
      reason: "skipped",
      reasonDetail: `skipped Day ${m.day} (${m.title ?? "mission"})`,
      startDifficulty: 1,
    });
  }

  // 4. One verify-strength probe for candidates with credible first-try form.
  if (strong) {
    const firstTry = missions.filter(
      (m) => m.passed === true && (m.attempts ?? 0) === 1,
    );
    const pick = firstTry.find((m) => !usedDays.has(m.day!));
    if (pick) {
      add({
        day: pick.day!,
        module: moduleForDay(pick.day!, modules),
        reason: "verify-strength",
        reasonDetail: `first-try pass on Day ${pick.day} (${pick.title ?? "mission"}), verify it's real depth`,
        startDifficulty: 3,
      });
    }
  }

  // 5. Fill remaining slots with core days (works even for empty candidates).
  for (const core of CORE_DAYS) {
    if (topics.length >= MIN_TOPICS && usedDays.size >= MIN_DISTINCT_DAYS) break;
    add({
      day: core.day,
      module: moduleForDay(core.day, modules),
      reason: "core",
      reasonDetail: `${core.title}, cohort spine topic`,
      startDifficulty: strong ? 2 : 1,
    });
  }

  return topics;
}

// ---------------------------------------------------------------------------
// Per-turn guardrails (TRD §5.2), applied ON TOP of the LLM's decision
// ---------------------------------------------------------------------------

/** Raw LLM proposal, difficulty arrives as a plain number and gets clamped. */
export type TurnDecision = {
  action: TurnAction;
  nextDay: number;
  nextDifficulty: number;
};

export type GuardedDecision = Omit<TurnDecision, "nextDifficulty"> & {
  nextDifficulty: Difficulty;
  /** Human-readable notes for every policy override (Brain panel material). */
  forced: string[];
};

export function distinctDays(turns: Turn[]): number[] {
  return [...new Set(turns.map((t) => t.day))];
}

/** First planned day not yet covered; falls back to core days, then stays put. */
export function pickUncoveredDay(state: SessionState): number {
  const covered = new Set(distinctDays(state.turns ?? []));
  const planned = state.plan?.topics.find((t) => !covered.has(t.day));
  if (planned) return planned.day;
  const core = CORE_DAYS.find((c) => !covered.has(c.day));
  if (core) return core.day;
  return state.turns?.at(-1)?.day ?? CORE_DAYS[0].day;
}

function clampDifficulty(d: number): Difficulty {
  return Math.min(3, Math.max(1, Math.round(d))) as Difficulty;
}

/**
 * Enforce the deterministic rules on the LLM's proposed decision.
 * Order matters: hard caps beat coverage, coverage beats variety,
 * variety beats difficulty adjustments.
 */
export function applyGuardrails(
  proposed: TurnDecision,
  state: SessionState,
): GuardedDecision {
  const forced: string[] = [];
  const turns = state.turns ?? [];
  const asked = turns.length;
  const covered = distinctDays(turns);
  let { action, nextDay } = proposed;
  let nextDifficulty: Difficulty = clampDifficulty(proposed.nextDifficulty);

  if (!Number.isInteger(nextDay) || nextDay < 1 || nextDay > 31) {
    nextDay = pickUncoveredDay(state);
    forced.push(`invalid day proposed, redirected to Day ${nextDay}`);
  }

  const lastEval = turns.at(-1)?.eval;

  // Rule: hard cap, no question 15, ever.
  if (asked >= HARD_CAP) {
    if (action !== "wrap") forced.push(`hard cap ${HARD_CAP} reached, wrapping`);
    return { action: "wrap", nextDay, nextDifficulty, forced };
  }

  // Rule: don't let the interview run past the wrap window...
  if (asked >= FORCE_WRAP_AT && action !== "wrap") {
    // ...unless the coverage minimum is still unmet, then rescue coverage
    // with the remaining headroom before the hard cap.
    if (covered.length < MIN_DISTINCT_DAYS) {
      const day = pickUncoveredDay(state);
      forced.push(
        `${asked} questions asked but only ${covered.length} days covered, forced switch to Day ${day}`,
      );
      return { action: "switch", nextDay: day, nextDifficulty: 1, forced };
    }
    forced.push(`wrap window (${FORCE_WRAP_AT}+), wrapping`);
    return { action: "wrap", nextDay, nextDifficulty, forced };
  }

  // Rule: no wrapping before the contract minimum of 8 questions.
  if (action === "wrap" && asked < MIN_QUESTIONS) {
    const day = pickUncoveredDay(state);
    forced.push(
      `only ${asked} questions asked (minimum ${MIN_QUESTIONS}), continuing on Day ${day}`,
    );
    action = "switch";
    nextDay = day;
  }

  // Rule: coverage floor, from turn 6, force breadth until ≥4 distinct days.
  if (
    action !== "wrap" &&
    asked >= COVERAGE_CHECK_FROM &&
    covered.length < MIN_DISTINCT_DAYS &&
    (action !== "switch" || covered.includes(nextDay))
  ) {
    const day = pickUncoveredDay(state);
    forced.push(
      `coverage floor: ${covered.length}/${MIN_DISTINCT_DAYS} days at ${asked} questions, forced switch to Day ${day}`,
    );
    action = "switch";
    nextDay = day;
  }

  // Rule: never 3 consecutive questions on the same day.
  const [prev, last] = [turns.at(-2), turns.at(-1)];
  if (
    action !== "wrap" &&
    prev &&
    last &&
    prev.day === last.day &&
    nextDay === last.day
  ) {
    const day = pickUncoveredDay(state);
    forced.push(
      `already 2 consecutive questions on Day ${last.day}, switching to Day ${day}`,
    );
    action = "switch";
    nextDay = day;
  }

  // Rule: "I don't know" is never punished with harder questions.
  if (lastEval?.classification === "dont-know" && action !== "wrap") {
    if (action === "escalate" || action === "drill") {
      const day = pickUncoveredDay(state);
      forced.push(
        `candidate said they don't know, moving on kindly to Day ${day} instead of pressing`,
      );
      action = "switch";
      nextDay = day;
      nextDifficulty = 1;
    } else {
      nextDifficulty = clampDifficulty(nextDifficulty - 1);
    }
  }

  // Rule: escalation is earned, cap difficulty jumps after weak answers.
  if (
    action !== "wrap" &&
    lastEval &&
    lastEval.score < 0.4 &&
    nextDifficulty > (turns.at(-1)?.difficulty ?? 1)
  ) {
    nextDifficulty = turns.at(-1)?.difficulty ?? 1;
    forced.push("difficulty increase blocked after a weak answer");
  }

  return { action, nextDay, nextDifficulty, forced };
}

// ---------------------------------------------------------------------------
// Pre-call directives, the same rules, phrased as instructions for the LLM
// so its reply text already matches what policy will allow (TRD §5.2).
// ---------------------------------------------------------------------------

/**
 * Turns an observer's steer into an instruction the model receives alongside
 * the policy directives. Deliberately phrased as a strong request rather than
 * a law, because applyGuardrails still runs afterwards and will overrule it if
 * it would break the contract minimums.
 */
export function steerDirective(steer: Steer): string {
  switch (steer.kind) {
    case "harder":
      return "OBSERVER STEER: press harder. Raise the difficulty and demand specifics rather than definitions.";
    case "easier":
      return "OBSERVER STEER: ease off. Drop the difficulty and rebuild confidence before probing again.";
    case "move-on":
      return "OBSERVER STEER: move on. Leave this topic and switch to a different planned curriculum day.";
    case "wrap":
      return "OBSERVER STEER: begin wrapping up. Close the interview as soon as the minimums allow.";
    case "day":
      return `OBSERVER STEER: go to Day ${steer.day} next and ask about that topic.`;
  }
}

export function computeDirectives(state: SessionState): string[] {
  const turns = state.turns ?? [];
  const asked = turns.length;
  const covered = distinctDays(turns);
  const directives: string[] = [];
  const last = turns.at(-1);
  const prev = turns.at(-2);

  if (asked >= FORCE_WRAP_AT) {
    directives.push("Wrap the interview NOW (action: wrap), the question budget is spent.");
    return directives;
  }
  if (asked < MIN_QUESTIONS) {
    directives.push(
      `Do NOT wrap yet, at least ${MIN_QUESTIONS} questions are required (currently ${asked}).`,
    );
  } else if (covered.length >= MIN_DISTINCT_DAYS && asked >= WRAP_FROM) {
    directives.push("You may wrap (action: wrap) once the remaining planned topics add nothing new.");
  }
  if (asked >= COVERAGE_CHECK_FROM - 1 && covered.length < MIN_DISTINCT_DAYS) {
    directives.push(
      `Coverage is ${covered.length}/${MIN_DISTINCT_DAYS} distinct days, switch to an uncovered planned day NOW.`,
    );
  }
  if (prev && last && prev.day === last.day) {
    directives.push(
      `Two consecutive questions were on Day ${last.day}, you MUST move to a different day.`,
    );
  }
  if (last?.eval?.classification === "dont-know") {
    directives.push(
      "The candidate said they don't know, acknowledge kindly, switch topic, drop to difficulty 1. Never press.",
    );
  }
  return directives;
}

// ---------------------------------------------------------------------------
// Confidence tracking (module title → 0-1, exponential moving average)
// ---------------------------------------------------------------------------

export function updateConfidence(
  confidence: Record<string, number>,
  module: string,
  score: number,
): Record<string, number> {
  const prior = confidence[module];
  return {
    ...confidence,
    [module]: prior === undefined ? score : prior * 0.5 + score * 0.5,
  };
}
