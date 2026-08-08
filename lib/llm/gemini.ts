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

/**
 * The chain, best first. Free tier quota is per model, so a third rung means
 * a judge keeps getting real answers after the first two are spent. Verified
 * available on 8 Aug 2026; gemini-2.5-flash-lite does not exist on this API.
 */
const MODEL_CHAIN = [
  process.env.GEMINI_MODEL ?? "gemini-3.5-flash",
  process.env.GEMINI_FALLBACK_MODEL ?? "gemini-3.1-flash-lite",
  process.env.GEMINI_LAST_RESORT_MODEL ?? "gemini-2.5-flash",
];

const CALL_TIMEOUT_MS = 25_000;
const ATTEMPTS_PER_MODEL = 2;
/** Used when a 429 arrives without a parseable retry hint. */
const DEFAULT_COOLDOWN_MS = 30_000;
const MAX_COOLDOWN_MS = 5 * 60_000;

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

/* ---------------------------------------------------------------------------
   Quota circuit breaker.

   A 429 means the model's quota is spent, not that the call was unlucky, so
   retrying the same model is pure latency. Measured 8 Aug 2026: with the
   primary exhausted, the old retry-then-fall-through path added about 1.4s of
   pointless waiting to every single call. Once a model reports 429 it is
   skipped until its own retry hint expires.
--------------------------------------------------------------------------- */

const g = globalThis as typeof globalThis & {
  __vivaModelCooldown?: Map<string, number>;
};

function cooldowns(): Map<string, number> {
  if (!g.__vivaModelCooldown) g.__vivaModelCooldown = new Map();
  return g.__vivaModelCooldown;
}

function isCoolingDown(model: string): boolean {
  const until = cooldowns().get(model);
  if (until === undefined) return false;
  if (Date.now() >= until) {
    cooldowns().delete(model);
    return false;
  }
  return true;
}

function isQuotaError(message: string): boolean {
  return (
    /429|RESOURCE_EXHAUSTED|quota|rate limit/i.test(message) &&
    !/API key|PERMISSION_DENIED/i.test(message)
  );
}

/** Gemini reports "Please retry in 15.5s"; honour it rather than guessing. */
function coolDown(model: string, message: string): void {
  const hint =
    message.match(/retry in (\d+(?:\.\d+)?)s/i)?.[1] ??
    message.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/i)?.[1];
  const ms = hint ? Number(hint) * 1000 + 500 : DEFAULT_COOLDOWN_MS;
  cooldowns().set(model, Date.now() + Math.min(ms, MAX_COOLDOWN_MS));
  console.warn(`[gemini] ${model} quota exhausted, skipping for ${Math.round(ms / 1000)}s`);
}

/** Exposed for /api/health so an exhausted key is visible without guessing. */
export function modelChainStatus(): { model: string; cooldownMs: number }[] {
  const now = Date.now();
  return MODEL_CHAIN.map((model) => ({
    model,
    cooldownMs: Math.max(0, (cooldowns().get(model) ?? 0) - now),
  }));
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
  let triedAnything = false;

  for (const model of MODEL_CHAIN) {
    // Skip a model whose quota we already know is spent.
    if (isCoolingDown(model)) continue;

    for (let attempt = 0; attempt < ATTEMPTS_PER_MODEL; attempt++) {
      triedAnything = true;
      try {
        return await callModel(model, schema, opts);
      } catch (err) {
        lastError = err;
        const message = String(err);

        // Auth problems will not heal on any model with this key.
        if (/API key|PERMISSION_DENIED|UNAUTHENTICATED/i.test(message)) {
          throw new LlmError(`credentials rejected: ${message}`);
        }

        // Quota is not bad luck. Move to the next model immediately.
        if (isQuotaError(message)) {
          coolDown(model, message);
          break;
        }

        // A malformed or empty response is worth one honest retry.
        if (attempt + 1 < ATTEMPTS_PER_MODEL) await sleep(backoffMs(attempt));
      }
    }
  }

  if (!triedAnything) {
    throw new LlmError("every model is rate limited right now");
  }
  throw new LlmError(`all models failed: ${String(lastError)}`);
}
