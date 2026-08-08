/**
 * Verifies that what Viva remembers about a candidate is actually about the
 * candidate, not about the syllabus. Writes a report-shaped memory under a
 * throwaway id, then reads it back and reports how many recalled facts name
 * the person.
 *
 *   npx tsx scripts/memory-smoke.ts
 * Requires BREETH_ENABLED=true and BREETH_API_KEY in env.
 */
import type { SessionState } from "../lib/types";
import { recallCandidateMemories, writeInterviewMemory } from "../lib/store/breeth";

const ID = `CAND-MEM${Date.now().toString().slice(-6)}`;
const NAME = "Rohan Desai";

const state = {
  sessionId: "memory-smoke",
  candidate: { member: { id: ID, name: NAME, jobRole: "Backend Engineer" } },
  askedCount: 10,
  phase: "done",
  startedAt: new Date().toISOString(),
  turns: [
    {
      q: "q",
      a: "a",
      day: 23,
      difficulty: 1,
      rationale: "r",
      eval: {
        score: 0.1,
        classification: "dont-know",
        evidence: "I never got MCP working end to end",
      },
    },
  ],
  report: {
    feedback: {
      summary: `${NAME} reasons well about retrieval but cannot yet connect it to deployment.`,
      strengths: ["Clear grasp of ANN indexing and when similarity search wins"],
      gaps: [
        "Could not explain the Model Context Protocol client and host roles",
        "Unclear on persistent storage for a stateful vector database",
      ],
      next: ["Revisit Day 23 (MCP) and build a small server"],
    },
  },
} as unknown as SessionState;

async function main() {
  console.log(`writing candidate-centred memory for ${NAME} (${ID})`);
  await writeInterviewMemory(state);

  for (let i = 0; i < 10; i++) {
    const facts = await recallCandidateMemories(ID, NAME);
    if (facts.length > 0) {
      console.log(`\nrecalled ${facts.length} memories after about ${i * 3}s:\n`);
      for (const f of facts) console.log("  -", f);
      const first = NAME.split(" ")[0].toLowerCase();
      const named = facts.filter((f) => f.toLowerCase().includes(first)).length;
      const syllabus = facts.filter((f) => /^Day \d+ (focuses|covers|requires)/i.test(f)).length;
      console.log(`\n${named}/${facts.length} name the candidate`);
      console.log(`${syllabus}/${facts.length} are syllabus facts (want 0)`);
      process.exit(named > 0 && syllabus === 0 ? 0 : 1);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  console.error("TIMEOUT: nothing became searchable");
  process.exit(1);
}

main();
