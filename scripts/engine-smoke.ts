/**
 * Engine smoke test: exercises generateStructured with the real production
 * schemas (plan polish + turn) exactly as the engine calls them.
 *
 *   npx tsx scripts/engine-smoke.ts
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateStructured } from "../lib/llm/gemini";
import { PlanPolishSchema, TurnOutputSchema } from "../lib/llm/schemas";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { candidates } = JSON.parse(
  readFileSync(join(root, "lib", "data", "candidates.json"), "utf-8"),
);
const cand = candidates.find((c: { member: { id: string } }) => c.member.id === "CAND-004");

async function main() {
  try {
    const t0 = Date.now();
    const plan = await generateStructured(PlanPolishSchema, {
      system: "You are the planning half of an AI interviewer.",
      prompt: `Candidate: ${JSON.stringify(cand)}\nTopics: Day 8 (5 attempts), Day 23 (5 attempts), Day 28 (skipped).\nWrite personaNotes and one reasonDetail line per topic day.`,
    });
    console.log(`PLAN OK in ${Date.now() - t0}ms:`, JSON.stringify(plan).slice(0, 300));
  } catch (e) {
    console.log("PLAN FAIL:", String(e).slice(0, 600));
  }

  try {
    const t0 = Date.now();
    const turn = await generateStructured(TurnOutputSchema, {
      system: "You are a technical interviewer. Evaluate and decide.",
      prompt: `Q (Day 8, L1): What does a vector database do differently than SQL?\nA: "It stores embeddings and searches by similarity."\nPOLICY DIRECTIVES: none. Decide the next move.`,
    });
    console.log(`TURN OK in ${Date.now() - t0}ms:`, JSON.stringify(turn).slice(0, 300));
  } catch (e) {
    console.log("TURN FAIL:", String(e).slice(0, 600));
  }
}

main();
