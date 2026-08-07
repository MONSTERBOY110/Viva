/**
 * Breeth integration smoke test: writes an interview memory directly (no
 * route, no after()), polls until it's searchable, prints recalled facts.
 *
 *   npx tsx scripts/breeth-smoke.ts
 * Requires BREETH_ENABLED=true and BREETH_API_KEY in env.
 */
import type { SessionState } from "../lib/types";
import { recallCandidateMemories, writeInterviewMemory } from "../lib/store/breeth";

const state: SessionState = {
  sessionId: "breeth-smoke",
  candidate: {
    member: { id: "CAND-004", name: "David Miller", jobRole: "Business Analyst" },
  },
  askedCount: 12,
  phase: "done",
  startedAt: new Date().toISOString(),
  turns: [
    { q: "q1", day: 8, difficulty: 1, rationale: "r" },
    { q: "q2", day: 23, difficulty: 1, rationale: "r" },
  ],
  report: {
    feedback: {
      summary:
        "David showed solid high-level architecture instincts but struggled with MCP internals and vector index mechanics.",
      strengths: ["Clear grasp of RAG grounding and when to use it"],
      gaps: [
        "Could not explain MCP client-server architecture",
        "Unclear on HNSW/ANN index mechanics",
      ],
      next: ["Revisit Day 23 (MCP) — build a small MCP server hands-on"],
    },
  },
};

async function main() {
  console.log("1) writing interview memory…");
  await writeInterviewMemory(state);

  console.log("2) polling recall until searchable…");
  for (let i = 0; i < 20; i++) {
    const facts = await recallCandidateMemories("CAND-004");
    if (facts.length > 0) {
      console.log(`RECALLED after ~${i * 3}s:`);
      for (const f of facts) console.log(`  - ${f}`);
      return;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  console.error("TIMEOUT: memory never became searchable");
  process.exit(1);
}

main();
