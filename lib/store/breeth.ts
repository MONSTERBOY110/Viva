import type { Feedback, SessionState } from "@/lib/types";

/**
 * Breeth long-term memory (TRD §6): cross-session candidate continuity.
 * Feature-flagged and fail-silent by design, if BREETH_ENABLED is not "true",
 * the key is missing/placeholder, or the API errors, every function is a
 * harmless no-op. The product must be whole without it.
 *
 * API surface verified against docs.thebreeth.com on 7 Aug 2026:
 *   POST /v1/episodes  { content, group_id, source_description }
 *   POST /v1/search    { query, group_id, limit } → { edges: [{ fact, … }] }
 *   Auth: Bearer ck_live_…
 */

const BASE_URL = "https://api.thebreeth.com/v1";
// Recall sits on the start request's critical path, keep it tight.
// Writes run via after() once the response is sent, and Breeth extracts
// entities synchronously on write (measured >4s), give them room.
// Recall now runs alongside the planner rather than before it, so this only
// needs to beat the planner's own call. Measured 8 Aug 2026: Breeth search
// answers in roughly 3s, so a 4s ceiling was silently setting the floor.
const RECALL_TIMEOUT_MS = 3_500;
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

    /**
     * Breeth builds a knowledge graph from this prose, so whatever is the
     * grammatical subject becomes the entity it remembers. Writing "Revisit
     * Day 10 (Retrieval)" taught it facts about the curriculum instead of
     * facts about the candidate, and the recalled continuity read like a
     * syllabus. Every line is therefore a sentence about this person, and the
     * study recommendations are left out entirely: they describe the course,
     * not the human, and the next interview only needs to know what they could
     * and could not do.
     */
    const sentences: string[] = [
      `${name} (${candidateId}) was interviewed by Viva on ${state.startedAt.slice(0, 10)}.`,
      `${name}: ${f.summary}`,
    ];
    // A fixed frame around the model's own wording, so the sentence stays
    // grammatical no matter how the report phrased the item.
    for (const s of f.strengths) {
      sentences.push(`${name} showed a strength: ${s}`);
    }
    for (const g of f.gaps) {
      sentences.push(`${name} showed a gap: ${g}`);
    }

    // The strongest evidence is the candidate's own words, attributed to them.
    for (const turn of (state.turns ?? []).slice(0, 12)) {
      if (turn.eval && turn.eval.score <= 0.3 && turn.eval.evidence) {
        sentences.push(
          `On Day ${turn.day}, ${name} answered "${turn.eval.evidence}" which was judged ${turn.eval.classification}.`,
        );
      }
    }

    const content = sentences.join("\n");
    // wait_seconds blocks until Breeth's extraction pipeline has landed the
    // facts (verified 8 Aug 2026: async-mode writes can lag indefinitely,
    // blocking writes are searchable within seconds). We run inside after(),
    // so the judge's response is long gone, blocking here costs nothing.
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
 * Returns [] on any failure, the planner treats absence as "first interview".
 */
export async function recallCandidateMemories(
  candidateId: string | undefined,
  candidateName?: string,
): Promise<string[]> {
  if (!breethEnabled() || !candidateId) return [];
  try {
    const who = candidateName ?? candidateId;
    const res = await breethFetch(
      "/search",
      {
        // Ask about the person, not the syllabus. A query about
        // "recommendations" pulls back curriculum facts, because the study
        // steps name curriculum days rather than the candidate.
        query: `What did ${who} get right and wrong in their previous interview? Their strengths, gaps and answers.`,
        group_id: groupId(candidateId),
        limit: 12,
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
      // Breeth's graph also yields thin structural edges ("Curriculum day 10")
      // and syllabus facts ("Day 10 covers cosine similarity"). Neither is
      // about this person, and a continuity line built from them reads like a
      // course outline. Keep only substantial facts, and prefer the ones that
      // name the candidate.
      .filter((f) => f.length >= 28 && f.split(/\s+/).length >= 5)
      .filter((f) => !/^Day \d+ (focuses|covers|requires)/i.test(f))
      .sort((a, b) => {
        const named = (t: string) =>
          candidateName && t.toLowerCase().includes(candidateName.toLowerCase())
            ? 0
            : 1;
        return named(a) - named(b);
      })
      .slice(0, 6);
    if (facts.length > 0) {
      console.log(`[breeth] recalled ${facts.length} memories for ${candidateId}`);
    }
    return facts;
  } catch (err) {
    console.warn(`[breeth] recall error: ${String(err).slice(0, 200)}`);
    return [];
  }
}
