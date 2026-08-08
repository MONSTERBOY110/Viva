import { NextResponse } from "next/server";
import { sessionStoreKind } from "@/lib/store/session";
import { voiceEnabled } from "@/lib/voice";
import { breethEnabled } from "@/lib/store/breeth";

export const dynamic = "force-dynamic";

/**
 * Liveness probe for the organizers' auto-verifier (TRD section 10).
 *
 * `ok` is the only field the verifier needs. The rest report which optional
 * layers this particular deployment actually has, which is the fastest way to
 * catch an environment variable that was added to the dashboard but never
 * reached a running build.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "viva",
    version: "0.1.0",
    store: sessionStoreKind(),
    engine: process.env.GEMINI_API_KEY ? "gemini" : "deterministic",
    voice: voiceEnabled() ? "on" : "off",
    memory: breethEnabled() ? "on" : "off",
  });
}
