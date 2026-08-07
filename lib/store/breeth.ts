import type { Feedback, SessionState } from "@/lib/types";

/**
 * Breeth long-term memory (TRD §6): cross-session candidate continuity.
 * Feature-flagged and fail-silent by design — if BREETH_ENABLED is not "true",
 * the key is missing/placeholder, or the API errors, every function is a
 * harmless no-op. The product must be whole without it.
 *
 * API surface verified against docs.thebreeth.com on 7 Aug 2026:
 *   POST /v1/episodes  { content, group_id, source_description }
 *   POST /v1/search    { query, group_id, limit } → { edges: [{ fact, … }] }
 *   Auth: Bearer ck_live_…
 */

const BASE_URL = "https://api.thebreeth.com/v1";
// Recall sits on the start request's critical path — keep it tight.
// Writes run via after() once the response is sent, and Breeth extracts
// entities synchronously on write (measured >4s) — give them room.
const RECALL_TIMEOUT_MS = 4_000;
const WRITE_TIMEOUT_MS = 45_000; // must outlast the write's wait_seconds=30

export function breethEnabled(): boolean {
  const key = process.env.BREETH_API_KEY ?? "";
  return (
    process.env.BREETH_ENABLED === "true" &&
    key.length > 0 &&
    !key.startsWith("your-")
  );
}

/** Candidate-scoped memory bucket; custom candidates without an id get none. */
function groupId(candidateId: string): string {
  return `viva-${candidateId.toLowerCase().replace(/[^a-z0-9-]/g, "")}`;
}

async function breethFetch(
  path: string,
  body: unknown,
  timeoutMs: number,
): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.BREETH_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/**
 * On interview completion: persist a compact narrative of how it went.
 * Breeth extracts entities/relations from plain prose, so we write prose.
 */
export async function writeInterviewMemory(state: SessionState): Promise<void> {
  const candidateId = state.candidate.member?.id;
  if (!breethEnabled() || !candidateId || !state.report) return;
  try {
    const name = state.candidate.member?.name ?? candidateId;
    const f: Feedback = state.report.feedback;
    const days = [...new Set((state.turns ?? []).map((t) => t.day))].join(", ");
    const content = [
      `Interview with ${name} (${candidateId}) on ${state.startedAt.slice(0, 10)} covering curriculum days ${days}.`,
      `Summary: ${f.summary}`,
      f.strengths.length ? `Strengths: ${f.strengths.join(" | ")}` : "",
      f.gaps.length ? `Gaps: ${f.gaps.join(" | ")}` : "",
      f.next.length ? `Recommended next steps: ${f.next.join(" | ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    // wait_seconds blocks until Breeth's extraction pipeline has landed the
    // facts (verified 8 Aug 2026: async-mode writes can lag indefinitely,
    // blocking writes are searchable within seconds). We run inside after(),
    // so the judge's response is long gone — blocking here costs nothing.
    const res = await breethFetch(
      "/episodes?wait_seconds=30",
      {
        content,
        group_id: groupId(candidateId),
        source_description: "viva-interview",
      },
      WRITE_TIMEOUT_MS,
    );
    if (res.ok) {
      console.log(`[breeth] memory written for ${candidateId} (${res.status})`);
    } else {
      console.warn(`[breeth] write failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    }
  } catch (err) {
    // Memory is an enhancement; the interview outcome is already delivered.
    console.warn(`[breeth] write error: ${String(err).slice(0, 200)}`);
  }
}

/**
 * On interview start: recall what previous sessions surfaced, as short facts.
 * Returns [] on any failure — the planner treats absence as "first interview".
 */
export async function recallCandidateMemories(
  candidateId: string | undefined,
): Promise<string[]> {
  if (!breethEnabled() || !candidateId) return [];
  try {
    const res = await breethFetch(
      "/search",
      {
        query: "previous interview: gaps, weaknesses, strengths, recommendations",
        group_id: groupId(candidateId),
        limit: 8,
      },
      RECALL_TIMEOUT_MS,
    );
    if (!res.ok) {
      console.warn(`[breeth] recall failed: HTTP ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { edges?: { fact?: string }[] };
    const facts = (data.edges ?? [])
      .map((e) => e.fact?.trim())
      .filter((f): f is string => Boolean(f))
      .slice(0, 8);
    if (facts.length > 0) {
      console.log(`[breeth] recalled ${facts.length} memories for ${candidateId}`);
    }
    return facts;
  } catch (err) {
    console.warn(`[breeth] recall error: ${String(err).slice(0, 200)}`);
    return [];
  }
}
