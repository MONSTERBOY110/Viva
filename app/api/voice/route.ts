import { NextResponse } from "next/server";
import {
  listVoices,
  registerUtterance,
  resolveVoiceId,
  speakableText,
  voiceEnabled,
  defaultVoiceId,
} from "@/lib/voice";

export const dynamic = "force-dynamic";

/**
 * Voice capability and utterance registration.
 *
 * GET  reports whether the spoken examiner is available and which voices the
 *      account offers, so the interface can hide the controls entirely when
 *      it is not configured.
 * POST registers a line to be spoken and returns a short id. The audio itself
 *      streams from GET /api/voice/[id], because an <audio> element needs a
 *      plain URL and the API key must never reach the browser.
 *
 * Silence is always an acceptable outcome here. Nothing in this file can
 * block or fail an interview turn.
 */

export async function GET() {
  if (!voiceEnabled()) {
    return NextResponse.json({ enabled: false, voices: [], defaultVoice: null });
  }
  return NextResponse.json({
    enabled: true,
    voices: await listVoices(),
    defaultVoice: defaultVoiceId(),
  });
}

export async function POST(req: Request) {
  try {
    if (!voiceEnabled()) return new NextResponse(null, { status: 204 });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
    }

    const { text, voice } = (body ?? {}) as { text?: unknown; voice?: unknown };
    if (typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "A non-empty string text field is required." },
        { status: 400 },
      );
    }

    const speech = speakableText(text);
    const voiceId = resolveVoiceId(typeof voice === "string" ? voice : null);
    const id = await registerUtterance(speech, voiceId);

    return NextResponse.json({ id, chars: speech.length });
  } catch (err) {
    console.warn(`[voice] register failed: ${String(err).slice(0, 160)}`);
    return new NextResponse(null, { status: 204 });
  }
}
