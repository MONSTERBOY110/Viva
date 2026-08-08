import { NextResponse } from "next/server";
import {
  VOICE_SETTINGS,
  readUtterance,
  voiceEnabled,
  voiceModel,
} from "@/lib/voice";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Streams a registered utterance as audio/mpeg.
 *
 * The upstream body is piped straight through rather than buffered, so the
 * browser starts playing while ElevenLabs is still generating. That is the
 * difference between the examiner answering in about half a second and
 * appearing to pause for thought after every question.
 *
 * Any failure returns 204 so the page simply falls quiet.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!voiceEnabled()) return new NextResponse(null, { status: 204 });

    const { id } = await params;
    if (!/^[a-f0-9]{8,32}$/.test(id)) {
      return new NextResponse(null, { status: 204 });
    }

    const utterance = await readUtterance(id);
    if (!utterance) return new NextResponse(null, { status: 204 });

    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${utterance.voice}/stream?optimize_streaming_latency=3&output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY as string,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: utterance.text,
          model_id: voiceModel(),
          voice_settings: VOICE_SETTINGS,
        }),
        signal: AbortSignal.timeout(45_000),
      },
    );

    if (!upstream.ok || !upstream.body) {
      // 401 bad key, 402 quota spent, 429 rate limited. All mean silence.
      const detail = await upstream.text().catch(() => "");
      console.warn(
        `[voice] upstream ${upstream.status}: ${detail.slice(0, 200)}`,
      );
      return new NextResponse(null, { status: 204 });
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, max-age=900",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.warn(`[voice] stream failed: ${String(err).slice(0, 160)}`);
    return new NextResponse(null, { status: 204 });
  }
}
