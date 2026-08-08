import { GoogleGenAI } from "@google/genai";
import * as z from "zod";
import { scrubStrings } from "@/lib/text";

/**
 * Gemini provider adapter (TRD §5.4): structured JSON mode, zod validation
 * with one repair retry, exponential backoff with jitter, and a model
 * fallback chain. This module may throw only LlmError, routes catch it and
 * answer with a graceful in-character line (never 5xx to a judge).
 *
 * Model names verified against ai.google.dev on 7 Aug 2026:
 * gemini-3.5-flash (stable, free tier) then gemini-3.1-flash-lite (stable, free tier).
 */

const PRIMARY_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL ?? "gemini-3.1-flash-lite";
const CALL_TIMEOUT_MS = 25_000;
const ATTEMPTS_PER_MODEL = 2;

export class LlmError extends Error {
  constructor(
    message: string,
    readonly kind: "unconfigured" | "exhausted" = "exhausted",
  ) {
    super(message);
    this.name = "LlmError";
  }
}

export function llmAvailable(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new LlmError("GEMINI_API_KEY is not configured", "unconfigured");
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function backoffMs(attempt: number): number {
  return 500 * 2 ** attempt + Math.random() * 250;
}

/** Defensive: strip markdown fences if the model ever wraps its JSON. */
function stripFences(text: string): string {
  return text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
}

export type GenerateOptions = {
  system: string;
  prompt: string;
  temperature?: number;
};

async function callModel<T>(
  model: string,
  schema: z.ZodType<T>,
  opts: GenerateOptions,
): Promise<T> {
  const ai = getClient();
  const call = ai.models.generateContent({
    model,
    contents: opts.prompt,
    config: {
      systemInstruction: opts.system,
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(schema),
      temperature: opts.temperature ?? 0.7,
      // Measured 7 Aug 2026 on gemini-3.5-flash: budget 0 → ~2s/turn,
      // default → ~6s with no visible quality gain for this task shape.
      thinkingConfig: {
        thinkingBudget: Number(process.env.GEMINI_THINKING_BUDGET ?? 0),
      },
    },
  });
  const response = await Promise.race([
    call,
    sleep(CALL_TIMEOUT_MS).then(() => {
      throw new Error(`timeout after ${CALL_TIMEOUT_MS}ms on ${model}`);
    }),
  ]);
  const text = response.text;
  if (!text) throw new Error(`empty response from ${model}`);
  // House punctuation rule enforced at the boundary, so no model slip reaches
  // a judge even though the prompts already forbid dashes.
  return schema.parse(scrubStrings(JSON.parse(stripFences(text))));
}

/**
 * Generate a schema-validated object with the full resilience chain:
 * primary model (2 attempts, backoff) → fallback model (2 attempts) → LlmError.
 * A zod/JSON parse failure counts as a failed attempt (the retry IS the repair).
 */
export async function generateStructured<T>(
  schema: z.ZodType<T>,
  opts: GenerateOptions,
): Promise<T> {
  if (!llmAvailable()) {
    throw new LlmError("GEMINI_API_KEY is not configured", "unconfigured");
  }
  let lastError: unknown;
  for (const model of [PRIMARY_MODEL, FALLBACK_MODEL]) {
    for (let attempt = 0; attempt < ATTEMPTS_PER_MODEL; attempt++) {
      try {
        return await callModel(model, schema, opts);
      } catch (err) {
        lastError = err;
        const message = String(err);
        // Auth/config problems won't heal with retries on the same key.
        if (/API key|PERMISSION_DENIED|UNAUTHENTICATED/i.test(message)) break;
        if (attempt + 1 < ATTEMPTS_PER_MODEL) await sleep(backoffMs(attempt));
      }
    }
  }
  throw new LlmError(`all models failed: ${String(lastError)}`);
}
