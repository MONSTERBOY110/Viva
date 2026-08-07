/**
 * Gemini connectivity smoke test: tries each model in the chain with a tiny
 * structured call and prints latency. Reads GEMINI_API_KEY from env.
 *
 *   npx tsx scripts/gemini-smoke.ts
 */
import * as z from "zod";
import { GoogleGenAI } from "@google/genai";

const MODELS = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash"];

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY not set");
    process.exit(1);
  }
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  for (const model of MODELS) {
    try {
      const t0 = Date.now();
      const r = await ai.models.generateContent({
        model,
        contents: 'Reply with JSON: {"ok": true}',
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: z.toJSONSchema(z.object({ ok: z.boolean() })),
        },
      });
      console.log(`${model}: OK in ${Date.now() - t0}ms -> ${r.text}`);
    } catch (e) {
      console.log(`${model}: FAIL -> ${String(e).slice(0, 400)}`);
    }
  }
}

main();
