/**
 * Shared types. The judge-facing contract shapes (docs/technical-spec.md, TRD §3)
 * are sacred, request/response fields here must never change shape.
 */

/** One mission row from candidates.json, all fields optional; judges may paste custom candidates. */
export type CandidateMission = {
  day?: number;
  title?: string;
  passed?: boolean;
  attempts?: number;
  skipped?: boolean;
};

/** Candidate object as sent on the start request. Passed through loosely, never crash on extra/missing fields. */
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

/** Contract feedback object, field names and types fixed by technical-spec.md. */
export type Feedback = {
  summary: string;
  strengths: string[];
  gaps: string[];
  next: string[];
};

// ---------------------------------------------------------------------------
// Engine data models (TRD §4)
// ---------------------------------------------------------------------------

/** L1 recall · L2 application · L3 depth */
export type Difficulty = 1 | 2 | 3;

export type TopicReason = "struggled" | "skipped" | "verify-strength" | "core";

export type PlannedTopic = {
  /** Curriculum day this topic probes. */
  day: number;
  module: string;
  reason: TopicReason;
  /** Human-readable evidence, e.g. "4 attempts on Day 12". */
  reasonDetail: string;
  startDifficulty: Difficulty;
};

export type InterviewPlan = {
  candidateId: string;
  /** 5-6 topics spanning ≥4 distinct curriculum days. */
  topics: PlannedTopic[];
  /** e.g. "senior DevOps, respect experience, push depth" */
  personaNotes: string;
};

export type AnswerClassification =
  | "strong"
  | "partial"
  | "weak"
  | "evasive"
  | "dont-know";

export type TurnEval = {
  /** 0-1 */
  score: number;
  classification: AnswerClassification;
  /** Short quote from the answer backing the classification. */
  evidence: string;
};

export type TurnAction = "drill" | "escalate" | "switch" | "wrap";

export type Turn = {
  q: string;
  a?: string;
  day: number;
  difficulty: Difficulty;
  eval?: TurnEval;
  /** Brain panel: why this question was asked. */
  rationale: string;
};

export type SessionPhase = "active" | "wrapping" | "done";

/** Links one strengths/gaps item to the candidate's own words (report UI). */
export type EvidenceItem = {
  kind: "strength" | "gap";
  item: string;
  quote: string;
  day: number;
};

/**
 * Session state. The night-one canned flow uses candidate/askedCount/phase;
 * engine fields are optional so canned sessions already stored in Redis keep
 * parsing. The engine populates all of them from the start request onward.
 */
export type SessionState = {
  sessionId: string;
  candidate: Candidate;
  /** Number of questions asked so far (the start reply asks question 1). */
  askedCount: number;
  phase: SessionPhase;
  startedAt: string;
  plan?: InterviewPlan;
  turns?: Turn[];
  /** Distinct curriculum days already touched. */
  coverage?: number[];
  /** module title → 0-1 confidence. */
  confidence?: Record<string, number>;
  /** Final report, stored on wrap for idempotent end responses + report UI. */
  report?: { feedback: Feedback; evidenceMap?: EvidenceItem[] };
  /** Facts recalled from Breeth about previous interviews (continuity). */
  priorMemories?: string[];
};
