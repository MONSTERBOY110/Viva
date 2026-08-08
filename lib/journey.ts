import curriculum from "@/lib/data/curriculum.json";
import candidatesFile from "@/lib/data/candidates.json";
import type { Candidate } from "@/lib/types";

/**
 * The candidate's 31 days, resolved into the marks an examiner would make.
 * This is the data model behind the Ledger (DESIGN.md, The signature). It is
 * not a chart of the journey, it is the journey in the examiner's own notation.
 */

export type CurriculumDay = {
  day: number;
  title: string;
  type: string;
  tools?: string[];
  objectives?: string[];
};

export type CurriculumModule = { n: number; title: string; days: number[] };

export const DAYS = curriculum.days as CurriculumDay[];
export const MODULES = curriculum.modules as CurriculumModule[];
export const CANDIDATES = (candidatesFile.candidates as Candidate[]).filter(
  (c) => Boolean(c.member?.id),
);

export const TOTAL_DAYS = 31;

export function dayInfo(day: number): CurriculumDay | undefined {
  return DAYS.find((d) => d.day === day);
}

export function dayTitleFor(day: number): string {
  return dayInfo(day)?.title ?? `Day ${day}`;
}

export function moduleTitleFor(day: number): string {
  return (
    MODULES.find(({ days }) => day >= days[0] && day <= days[1])?.title ??
    "General"
  );
}

/** How a single day was left at the end of the cohort. */
export type MarkKind =
  | "first-try"
  | "struggled"
  | "skipped"
  | "failed"
  | "untouched";

export type DayMark = {
  day: number;
  kind: MarkKind;
  /** Number of attempts; 0 when skipped or untouched. */
  attempts: number;
  title: string;
  /** What an examiner would read from this mark, in one clause. */
  note: string;
};

const STRUGGLE_ATTEMPTS = 3;

export function journeyOf(candidate: Candidate): DayMark[] {
  const byDay = new Map<
    number,
    { attempts?: number; passed?: boolean; skipped?: boolean; title?: string }
  >();
  for (const m of candidate.missions ?? []) {
    if (typeof m?.day === "number") byDay.set(m.day, m);
  }

  return Array.from({ length: TOTAL_DAYS }, (_, i) => {
    const day = i + 1;
    const title = dayTitleFor(day);
    const mission = byDay.get(day);

    if (!mission) {
      return {
        day,
        kind: "untouched" as const,
        attempts: 0,
        title,
        note: "not attempted in the cohort",
      };
    }
    if (mission.skipped) {
      return { day, kind: "skipped" as const, attempts: 0, title, note: "skipped" };
    }
    const attempts = mission.attempts ?? 1;
    if (mission.passed === false) {
      return {
        day,
        kind: "failed" as const,
        attempts,
        title,
        note: `did not pass after ${attempts} ${attempts === 1 ? "attempt" : "attempts"}`,
      };
    }
    if (attempts >= STRUGGLE_ATTEMPTS) {
      return {
        day,
        kind: "struggled" as const,
        attempts,
        title,
        note: `passed on attempt ${attempts}`,
      };
    }
    return {
      day,
      kind: attempts === 1 ? ("first-try" as const) : ("struggled" as const),
      attempts,
      title,
      note: attempts === 1 ? "passed first try" : `passed on attempt ${attempts}`,
    };
  });
}

/** Headline signals for the roster row, phrased the way an examiner would note them. */
export function signalsOf(candidate: Candidate): string[] {
  const marks = journeyOf(candidate);
  const out: string[] = [];

  const failed = marks.filter((m) => m.kind === "failed");
  const skipped = marks.filter((m) => m.kind === "skipped");
  const hardest = marks
    .filter((m) => m.kind === "struggled" || m.kind === "failed")
    .sort((a, b) => b.attempts - a.attempts)[0];

  const done = candidate.signals?.missionsCompleted ?? 0;
  const firstTry = candidate.signals?.missionsFirstTry ?? 0;
  if (done > 0) {
    const pct = Math.round((firstTry / done) * 100);
    out.push(`${firstTry}/${done} first try`);
    if (pct >= 80) out.push("clean run");
  }
  if (hardest && hardest.attempts >= 4) {
    out.push(`${hardest.attempts} attempts on day ${hardest.day}`);
  }
  if (skipped.length > 0) {
    out.push(
      skipped.length === 1
        ? `skipped ${shortTitle(skipped[0].title)}`
        : `${skipped.length} days skipped`,
    );
  }
  if (failed.length > 0) out.push(`${failed.length} unpassed`);
  if (typeof candidate.signals?.commitDays === "number") {
    out.push(`${candidate.signals.commitDays}/31 active days`);
  }
  return out;
}

/** "Docker & Kubernetes Deployment" becomes "Docker", which fits a signal chip. */
function shortTitle(title: string): string {
  return title.split(/[&,:]/)[0].trim().split(" ").slice(0, 2).join(" ");
}

export function candidateById(id: string): Candidate | undefined {
  return CANDIDATES.find((c) => c.member?.id === id);
}
