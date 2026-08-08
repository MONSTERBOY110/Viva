import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";

/**
 * The spoken examiner. A viva voce is by definition an oral examination, so
 * Viva conducts one: it reads its questions aloud and listens to the answer.
 *
 * Audio is streamed rather than synthesised-then-sent, so speech begins in a
 * few hundred milliseconds. The browser plays audio/mpeg progressively, so a
 * plain <audio> element pointed at our streaming route is all the client needs.
 *
 * API verified against elevenlabs.io/docs on 8 Aug 2026:
 *   POST /v1/text-to-speech/{voice_id}/stream   (audio/mpeg, progressive)
 *   GET  /v1/voices                             (the account's voice list)
 *   header xi-api-key
 */

/** Examiner voices, in preference order. Overridden by the live account list. */
export const VOICE_CATALOG = [
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", note: "warm British, considered" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", note: "British, authoritative" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", note: "British, confident" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", note: "American, deep" },
] as const;

export const DEFAULT_VOICE_ID = VOICE_CATALOG[0].id;

/** Flash is the low latency model, roughly 75ms to first byte. */
const DEFAULT_MODEL = "eleven_flash_v2_5";

/**
 * A safety ceiling, not a budget. Interviewer replies are capped at 120 words
 * by the prompt, so this only ever catches a runaway generation.
 */
export const MAX_SPEECH_CHARS = 1800;

/** How long a prepared utterance stays fetchable. */
export const UTTERANCE_TTL_SECONDS = 900;

export function voiceEnabled(): boolean {
  const key = process.env.ELEVENLABS_API_KEY ?? "";
  if (key.length === 0 || key.startsWith("your-")) return false;
  // Configured means on. Set ELEVENLABS_ENABLED=false to explicitly disable.
  return process.env.ELEVENLABS_ENABLED !== "false";
}

export function voiceModel(): string {
  return process.env.ELEVENLABS_MODEL || DEFAULT_MODEL;
}

export function defaultVoiceId(): string {
  return process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
}

/** Only ids we recognise are ever forwarded upstream. */
export function resolveVoiceId(requested: string | null | undefined): string {
  if (!requested) return defaultVoiceId();
  return /^[A-Za-z0-9]{16,32}$/.test(requested) ? requested : defaultVoiceId();
}

/**
 * Strip what should not be read aloud, then cap length. On screen meta such as
 * "Q3" belongs to the page, not to the examiner's voice.
 */
export function speakableText(raw: string): string {
  const cleaned = raw
    .replace(/\s+/g, " ")
    .replace(/^(Q\d+\s*[.:)]\s*)/i, "")
    .trim();
  if (cleaned.length <= MAX_SPEECH_CHARS) return cleaned;
  const window = cleaned.slice(0, MAX_SPEECH_CHARS);
  const lastStop = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("? "),
    window.lastIndexOf("! "),
  );
  return lastStop > 400 ? window.slice(0, lastStop + 1) : window;
}

export function utteranceKey(text: string, voice: string): string {
  return createHash("sha256").update(`${voice}:${text}`).digest("hex").slice(0, 24);
}

/* ---------------------------------------------------------------------------
   Utterance registry.

   The browser needs a plain GET URL it can hand to an <audio> element, but the
   text is too long for a query string and the key must stay on the server. So
   the client registers the text, gets a short id back, and streams from it.
   Redis is used because on serverless the register and the stream can land on
   different instances; the in-memory map is the local dev fallback.
--------------------------------------------------------------------------- */

type Utterance = { text: string; voice: string };

const g = globalThis as typeof globalThis & {
  __vivaUtterances?: Map<string, Utterance>;
};

function memory(): Map<string, Utterance> {
  if (!g.__vivaUtterances) g.__vivaUtterances = new Map();
  return g.__vivaUtterances;
}

function redis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  if (url.includes("your-") || token.startsWith("your-")) return null;
  return new Redis({ url, token });
}

export async function registerUtterance(
  text: string,
  voice: string,
): Promise<string> {
  const id = utteranceKey(text, voice);
  const value: Utterance = { text, voice };
  const client = redis();
  if (client) {
    await client.set(`viva:tts:${id}`, value, { ex: UTTERANCE_TTL_SECONDS });
  } else {
    const map = memory();
    if (map.size > 200) map.delete(map.keys().next().value as string);
    map.set(id, value);
  }
  return id;
}

export async function readUtterance(id: string): Promise<Utterance | null> {
  const client = redis();
  if (client) {
    return (await client.get<Utterance>(`viva:tts:${id}`)) ?? null;
  }
  return memory().get(id) ?? null;
}

/* ------------------------------------------------------------------------- */

export type VoiceOption = { id: string; name: string; note: string };

/** The account's own voices, falling back to the catalog if the call fails. */
export async function listVoices(): Promise<VoiceOption[]> {
  if (!voiceEnabled()) return [];
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY as string },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok) return [...VOICE_CATALOG];
    const data = (await res.json()) as {
      voices?: { voice_id: string; name: string; labels?: Record<string, string> }[];
    };
    const available = new Map((data.voices ?? []).map((v) => [v.voice_id, v]));

    // Prefer the curated examiner voices the account actually has.
    const curated = VOICE_CATALOG.filter((v) => available.has(v.id)).map((v) => ({
      ...v,
    }));
    if (curated.length > 0) return curated;

    return (data.voices ?? []).slice(0, 6).map((v) => ({
      id: v.voice_id,
      name: v.name,
      note: [v.labels?.accent, v.labels?.description].filter(Boolean).join(", "),
    }));
  } catch {
    return [...VOICE_CATALOG];
  }
}

/** Steady and deliberate: an examiner, not a narrator performing. */
export const VOICE_SETTINGS = {
  stability: 0.55,
  similarity_boost: 0.75,
  style: 0.15,
  speed: 0.98,
  use_speaker_boost: true,
};
