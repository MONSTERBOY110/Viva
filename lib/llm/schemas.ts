import * as z from "zod";

/**
 * Zod schemas for every structured LLM output (TRD §5). These are the single
 * source of truth: they generate the JSON schema sent to Gemini
 * (responseJsonSchema) AND validate what comes back.
 */

export const TurnEvalSchema = z.object({
  score: z.number().min(0).max(1),
  classification: z.enum(["strong", "partial", "weak", "evasive", "dont-know"]),
  evidence: z
    .string()
    .describe("Short quote or paraphrase from the answer backing the classification"),
});

/** One structured call per turn: evaluate the answer, decide, ask (TRD §5.2). */
export const TurnOutputSchema = z.object({
  evaluation: TurnEvalSchema,
  action: z.enum(["drill", "escalate", "switch", "wrap"]),
  nextDay: z.number().int().min(1).max(31),
  nextDifficulty: z.number().int().min(1).max(3),
  rationale: z
    .string()
    .describe("One sentence for the Interviewer Brain panel: why this move"),
  reply: z
    .string()
    .describe("What the interviewer says next, references the candidate's words unless the answer was strong"),
});
export type TurnOutput = z.infer<typeof TurnOutputSchema>;

/** Planner polish: the deterministic topic pick stands; the LLM writes prose (TRD §5.1). */
export const PlanPolishSchema = z.object({
  personaNotes: z
    .string()
    .describe('Interviewer stance for this candidate, e.g. "senior DevOps, respect experience, push depth"'),
  topicDetails: z.array(
    z.object({
      day: z.number().int().min(1).max(31),
      reasonDetail: z
        .string()
        .describe("One vivid line on why this topic was chosen for THIS candidate"),
    }),
  ),
});
export type PlanPolish = z.infer<typeof PlanPolishSchema>;

/** Final report (TRD §5.3): contract feedback + internal evidence links. */
export const FeedbackOutputSchema = z.object({
  summary: z.string(),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  next: z.array(z.string()),
  evidenceMap: z
    .array(
      z.object({
        kind: z.enum(["strength", "gap"]),
        item: z.string().describe("The strengths/gaps entry this evidence backs"),
        quote: z.string().describe("The candidate's own words"),
        day: z.number().int().min(1).max(31),
      }),
    )
    .describe("Links each strength/gap to a quoted answer and curriculum day"),
});
export type FeedbackOutput = z.infer<typeof FeedbackOutputSchema>;
