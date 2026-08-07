/**
 * Shared types. The judge-facing contract shapes (docs/technical-spec.md, TRD §3)
 * are sacred — request/response fields here must never change shape.
 */

/** One mission row from candidates.json — all fields optional; judges may paste custom candidates. */
export type CandidateMission = {
  day?: number;
  title?: string;
  passed?: boolean;
  attempts?: number;
  skipped?: boolean;
};

/** Candidate object as sent on the start request. Passed through loosely — never crash on extra/missing fields. */
export type Candidate = {
  member?: {
    id?: string;
    name?: string;
    jobRole?: string;
    yearsExperience?: number;
    education?: string;
    status?: string;
  };
  missions?: CandidateMission[];
  signals?: {
    commitDays?: number;
    missionsCompleted?: number;
    missionsFirstTry?: number;
  };
  [key: string]: unknown;
};

/** Contract feedback object — field names and types fixed by technical-spec.md. */
export type Feedback = {
  summary: string;
  strengths: string[];
  gaps: string[];
  next: string[];
};

export type SessionPhase = "active" | "done";

/** Night-one session state. Grows into TRD §4's full SessionState when the engine lands. */
export type SessionState = {
  sessionId: string;
  candidate: Candidate;
  /** Number of questions asked so far (the start reply asks question 1). */
  askedCount: number;
  phase: SessionPhase;
  startedAt: string;
};
