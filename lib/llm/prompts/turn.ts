import type { SessionState, Turn } from "@/lib/types";

/**
 * Turn prompts (TRD §5.2): one structured call per turn — evaluate the latest
 * answer, decide the next move, write the next line. Policy directives are
 * injected so the model's reply already matches what the guardrails allow.
 */

export const TURN_SYSTEM = `You are Viva, a warm but rigorous technical interviewer for a 31-day AI engineering cohort.
Voice: professional, human, encouraging — never robotic, never cruel. You quote the candidate's own words when probing further.

Each turn you receive the interview state and the candidate's latest answer. You must return:
1. evaluation — score (0–1), classification (strong|partial|weak|evasive|dont-know), and a short evidence quote from THEIR answer.
   - "evasive" = fluent words that dodge the actual question. "dont-know" = honest admission.
2. action — drill (dig into the same topic), escalate (same topic, harder), switch (new planned day), wrap (end the interview).
3. nextDay + nextDifficulty (1 recall · 2 application · 3 depth) for the next question.
4. rationale — one sentence explaining the move, written for an observer panel ("4 attempts on Day 12 → testing prompting fundamentals").
5. reply — what you actually say: brief reaction to their answer, then the next question. Unless their answer was strong, your follow-up must reference their words. If action is wrap, reply is a short warm closing line WITHOUT feedback (the report follows separately).

POLICY DIRECTIVES in the prompt are mandatory — they override your own judgement.
Ask exactly one question per reply. Keep replies under 120 words.`;

function renderTurn(t: Turn, i: number): string {
  const answer = t.a ? `A: ${t.a}` : "A: (awaiting answer)";
  const evalLine = t.eval
    ? ` [scored ${t.eval.score.toFixed(2)} ${t.eval.classification}]`
    : "";
  return `Q${i + 1} (Day ${t.day}, L${t.difficulty}): ${t.q}\n${answer}${evalLine}`;
}

const VERBATIM_TURNS = 5;

export function turnPrompt(
  state: SessionState,
  latestAnswer: string,
  directives: string[],
): string {
  const turns = state.turns ?? [];
  const older = turns.slice(0, -VERBATIM_TURNS);
  const recent = turns.slice(-VERBATIM_TURNS);
  const plan = state.plan;
  const covered = [...new Set(turns.map((t) => t.day))];

  const sections: string[] = [];

  if (plan) {
    sections.push(
      "INTERVIEW PLAN:",
      `Persona notes: ${plan.personaNotes}`,
      ...plan.topics.map(
        (t) =>
          `- Day ${t.day} · ${t.module} · ${t.reason}: ${t.reasonDetail} (start L${t.startDifficulty})${covered.includes(t.day) ? " [covered]" : ""}`,
      ),
    );
  }

  if ((state.priorMemories ?? []).length > 0) {
    sections.push(
      "",
      "MEMORY FROM PREVIOUS INTERVIEWS (re-probe past gaps when natural; acknowledge improvement):",
      ...state.priorMemories!.map((m) => `- ${m}`),
    );
  }

  sections.push(
    "",
    `PROGRESS: ${turns.length} questions asked · days covered: ${covered.join(", ") || "none"}`,
  );

  if (Object.keys(state.confidence ?? {}).length > 0) {
    sections.push(
      "CONFIDENCE SO FAR: " +
        Object.entries(state.confidence!)
          .map(([m, c]) => `${m}: ${c.toFixed(2)}`)
          .join(" · "),
    );
  }

  if (older.length > 0) {
    sections.push(
      "",
      "EARLIER TURNS (summary):",
      ...older.map(
        (t) =>
          `- Day ${t.day} L${t.difficulty}: ${t.eval ? `${t.eval.classification} (${t.eval.score.toFixed(2)})` : "asked"}`,
      ),
    );
  }

  sections.push("", "RECENT TURNS (verbatim):", ...recent.map(renderTurn));
  sections.push("", `CANDIDATE'S LATEST ANSWER:\n${latestAnswer}`);

  if (directives.length > 0) {
    sections.push("", "POLICY DIRECTIVES (mandatory):", ...directives.map((d) => `- ${d}`));
  }

  return sections.join("\n");
}
