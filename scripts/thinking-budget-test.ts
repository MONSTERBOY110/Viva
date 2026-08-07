/**
 * Latency probe: gemini-3.5-flash across thinking budgets with a realistic
 * turn-shaped structured call.
 *
 *   npx tsx scripts/thinking-budget-test.ts
 */
import * as z from "zod";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const schema = z.toJSONSchema(
  z.object({
    evaluation: z.object({
      score: z.number(),
      classification: z.string(),
      evidence: z.string(),
    }),
    action: z.string(),
    nextDay: z.number(),
    nextDifficulty: z.number(),
    rationale: z.string(),
    reply: z.string(),
  }),
);
const prompt =
  'Q (Day 8, L2): Explain how HNSW speeds up similarity search.\nA: "It builds a graph of neighbors at multiple layers so you can skip most comparisons."\nEvaluate the answer and decide the next interviewer move.';

async function probe(budget: number | undefined, label: string) {
  try {
    const t0 = Date.now();
    const r = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: schema,
        ...(budget !== undefined ? { thinkingConfig: { thinkingBudget: budget } } : {}),
      },
    });
    const parsed = JSON.parse(r.text ?? "{}");
    console.log(`${label}: OK in ${Date.now() - t0}ms — reply: ${(parsed.reply ?? "").slice(0, 80)}`);
  } catch (e) {
    console.log(`${label}: FAIL -> ${String(e).slice(0, 250)}`);
  }
}

async function main() {
  await probe(0, "budget=0");
  await probe(128, "budget=128");
  await probe(undefined, "budget=default");
}

main();
