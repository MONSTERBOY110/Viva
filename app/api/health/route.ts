import { NextResponse } from "next/server";
import { sessionStoreKind } from "@/lib/store/session";

export const dynamic = "force-dynamic";

/** Liveness probe for the organizers' auto-verifier (TRD §10). */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "viva",
    version: "0.1.0",
    store: sessionStoreKind(),
  });
}
