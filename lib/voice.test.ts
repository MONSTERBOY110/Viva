import { afterEach, describe, expect, it } from "vitest";
import {
  MAX_SPEECH_CHARS,
  VOICE_CATALOG,
  defaultVoiceId,
  registerUtterance,
  readUtterance,
  resolveVoiceId,
  speakableText,
  utteranceKey,
  voiceEnabled,
} from "./voice";

/**
 * Voice is scoped out of the problem statement, so it must be invisible when
 * unconfigured. It must also never forward an unvetted voice id upstream or
 * hand the browser anything that could leak the key.
 */

const savedEnabled = process.env.ELEVENLABS_ENABLED;
const savedKey = process.env.ELEVENLABS_API_KEY;
const savedVoice = process.env.ELEVENLABS_VOICE_ID;

afterEach(() => {
  process.env.ELEVENLABS_ENABLED = savedEnabled;
  process.env.ELEVENLABS_API_KEY = savedKey;
  process.env.ELEVENLABS_VOICE_ID = savedVoice;
});

describe("voiceEnabled", () => {
  it("is on as soon as a real key is present", () => {
    process.env.ELEVENLABS_API_KEY = "sk_real_key_value";
    delete process.env.ELEVENLABS_ENABLED;
    expect(voiceEnabled()).toBe(true);
  });

  it("can be explicitly switched off with the flag", () => {
    process.env.ELEVENLABS_API_KEY = "sk_real_key_value";
    process.env.ELEVENLABS_ENABLED = "false";
    expect(voiceEnabled()).toBe(false);
  });

  it("treats an unfilled placeholder as unconfigured", () => {
    process.env.ELEVENLABS_API_KEY = "your-elevenlabs-api-key";
    delete process.env.ELEVENLABS_ENABLED;
    expect(voiceEnabled()).toBe(false);
  });

  it("is off when the key is missing", () => {
    process.env.ELEVENLABS_API_KEY = "";
    delete process.env.ELEVENLABS_ENABLED;
    expect(voiceEnabled()).toBe(false);
  });
});

describe("resolveVoiceId", () => {
  it("passes through a well formed id", () => {
    expect(resolveVoiceId(VOICE_CATALOG[1].id)).toBe(VOICE_CATALOG[1].id);
  });

  it("falls back to the default for anything malformed", () => {
    delete process.env.ELEVENLABS_VOICE_ID;
    for (const bad of ["", "../../secret", "short", null, undefined, "a b c"]) {
      expect(resolveVoiceId(bad)).toBe(defaultVoiceId());
    }
  });
});

describe("speakableText", () => {
  it("collapses whitespace and drops the question number prefix", () => {
    expect(speakableText("Q3: What   does\n an embedding represent?")).toBe(
      "What does an embedding represent?",
    );
  });

  it("never exceeds the safety ceiling", () => {
    const long = "Embeddings are dense vectors that capture meaning. ".repeat(200);
    expect(speakableText(long).length).toBeLessThanOrEqual(MAX_SPEECH_CHARS);
  });

  it("cuts at a sentence end rather than mid word", () => {
    const long = "This is a complete sentence. ".repeat(200);
    expect(speakableText(long).endsWith(".")).toBe(true);
  });

  it("leaves a normal interviewer reply untouched", () => {
    const reply =
      "Good answer. Since you mentioned HNSW, how would you tune efSearch for recall?";
    expect(speakableText(reply)).toBe(reply);
  });
});

describe("utterance registry", () => {
  it("round trips text and voice through a short id", async () => {
    const id = await registerUtterance("Why is that?", VOICE_CATALOG[0].id);
    expect(id).toMatch(/^[a-f0-9]{24}$/);
    const back = await readUtterance(id);
    expect(back).toEqual({ text: "Why is that?", voice: VOICE_CATALOG[0].id });
  });

  it("is deterministic, so replaying a question reuses the same id", () => {
    const a = utteranceKey("same line", "voice-1");
    const b = utteranceKey("same line", "voice-1");
    const c = utteranceKey("same line", "voice-2");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("returns null for an unknown id", async () => {
    expect(await readUtterance("deadbeefdeadbeefdeadbeef")).toBeNull();
  });
});
