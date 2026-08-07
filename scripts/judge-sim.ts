/**
 * judge-sim — scripted full-interview contract test against any deployment (TRD §8).
 *
 *   npx tsx scripts/judge-sim.ts                      # tests http://localhost:3000
 *   npx tsx scripts/judge-sim.ts https://viva.vercel.app
 *
 * Simulates a judge: health probe, a complete interview as CAND-001 with mixed
 * strong/weak/evasive/"I don't know" answers, asserting the technical-spec.md
 * contract shape on every turn, then the defensive paths (unknown session,
 * malformed body). Exit code 0 = pass, 1 = any failure.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = (process.argv[2] ?? "http://localhost:3000").replace(/\/+$/, "");
const MIN_QUESTIONS = 8;
const MAX_QUESTIONS = 14;
const MAX_REQUESTS = 25; // hard stop so a broken loop can't run forever
const REQUEST_TIMEOUT_MS = 30_000; // a judge would not wait longer either

const SCRIPTED_ANSWERS = [
  "An embedding is a dense numeric vector that captures the semantic meaning of text, so similar meanings end up close together in vector space — that's why cosine similarity works as a relevance signal.",
  "I don't know, honestly.",
  "It just matches words together I think.",
  "That's a great question — there are really many aspects and trade-offs to consider in these situations.",
  "You retrieve top-k chunks from the vector store, stuff them into a grounded prompt, and the LLM answers only from that context. Silent failures: bad chunking, stale index, or the model ignoring the context and hallucinating.",
  "Few-shot helps when the output format matters, like extracting structured fields; it backfires when the examples bias the model toward wrong patterns or eat the context budget.",
  "Honestly I'd have to look that one up.",
  "MCP standardizes how models talk to external tools: a server exposes tools, resources, and prompts over a common protocol so any compatible client can use them.",
  "Prompt injection through user text and data exfiltration via tool calls — guard with input sanitization, least-privilege tools, and output filtering.",
  "I'm not sure about that one, could we move on?",
];

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

type ApiResponse = { status: number; body: Record<string, unknown> | null; raw: string };

async function post(payload: unknown, rawBody?: string): Promise<ApiResponse> {
  const res = await fetch(`${BASE_URL}/api/interview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawBody ?? JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const raw = await res.text();
  let body: Record<string, unknown> | null = null;
  try {
    body = JSON.parse(raw);
  } catch {
    body = null;
  }
  return { status: res.status, body, raw };
}

function assertTurnShape(label: string, r: ApiResponse) {
  check(`${label}: status < 500`, r.status < 500, `got ${r.status}`);
  check(`${label}: valid JSON body`, r.body !== null, r.raw.slice(0, 120));
  if (r.body === null) return;
  check(
    `${label}: reply is a non-empty string`,
    typeof r.body.reply === "string" && (r.body.reply as string).trim().length > 0,
  );
  check(`${label}: done is a boolean`, typeof r.body.done === "boolean");
}

function assertFeedbackShape(feedback: unknown) {
  const f = feedback as Record<string, unknown> | null;
  const isStringArray = (v: unknown) =>
    Array.isArray(v) && v.every((x) => typeof x === "string");
  check("feedback is an object", typeof f === "object" && f !== null);
  if (typeof f !== "object" || f === null) return;
  check("feedback.summary is a string", typeof f.summary === "string");
  check("feedback.strengths is string[]", isStringArray(f.strengths));
  check("feedback.gaps is string[]", isStringArray(f.gaps));
  check("feedback.next is string[]", isStringArray(f.next));
}

async function main() {
  console.log(`\njudge-sim → ${BASE_URL}\n`);

  // ---- 1. Health probe -----------------------------------------------------
  console.log("1) GET /api/health");
  try {
    const res = await fetch(`${BASE_URL}/api/health`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = (await res.json()) as Record<string, unknown>;
    check("health returns 200", res.status === 200, `got ${res.status}`);
    check("health.ok === true", body?.ok === true);
  } catch (err) {
    check("health endpoint reachable", false, String(err));
  }

  // ---- 2. Full interview as CAND-001 ---------------------------------------
  console.log("\n2) Full interview (CAND-001, mixed-quality scripted answers)");
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const candidatesPath = join(scriptDir, "..", "lib", "data", "candidates.json");
  const { candidates } = JSON.parse(readFileSync(candidatesPath, "utf-8"));
  const candidate = candidates.find(
    (c: { member: { id: string } }) => c.member.id === "CAND-001",
  );
  check("CAND-001 found in lib/data/candidates.json", Boolean(candidate));

  const sessionId = randomUUID();
  const start = await post({ sessionId, candidate });
  assertTurnShape("start", start);
  check("start: done is false", start.body?.done === false);

  let questionsAsked = start.body?.done === false ? 1 : 0;
  let done = start.body?.done === true;
  let feedback: unknown = start.body?.feedback;
  let answerIdx = 0;

  while (!done && questionsAsked + 1 < MAX_REQUESTS) {
    const message = SCRIPTED_ANSWERS[answerIdx % SCRIPTED_ANSWERS.length];
    answerIdx++;
    const r = await post({ sessionId, message });
    assertTurnShape(`turn ${answerIdx}`, r);
    if (r.body === null) break;
    if (r.body.done === true) {
      done = true;
      feedback = r.body.feedback;
    } else {
      questionsAsked++;
    }
  }

  check("interview reached done:true", done, `stopped after ${answerIdx} answers`);
  check(
    `question count within ${MIN_QUESTIONS}–${MAX_QUESTIONS}`,
    questionsAsked >= MIN_QUESTIONS && questionsAsked <= MAX_QUESTIONS,
    `asked ${questionsAsked}`,
  );
  console.log("\n3) Feedback shape");
  assertFeedbackShape(feedback);

  // ---- 4. Defensive paths ---------------------------------------------------
  console.log("\n4) Defensive paths (never 5xx)");
  const ghost = await post({ sessionId: `ghost-${randomUUID()}`, message: "hello?" });
  check("unknown session (no candidate): status 200", ghost.status === 200, `got ${ghost.status}`);
  check(
    "unknown session: graceful reply present",
    typeof ghost.body?.reply === "string" && (ghost.body.reply as string).length > 0,
  );

  const malformed = await post(null, "this is {{ not json");
  check("malformed body: status 400", malformed.status === 400, `got ${malformed.status}`);
  check("malformed body: JSON error message", typeof malformed.body?.error === "string");

  const noSession = await post({ message: "no session id here" });
  check("missing sessionId: status 400", noSession.status === 400, `got ${noSession.status}`);
  check("missing sessionId: never 5xx", noSession.status < 500);

  // ---- Summary ---------------------------------------------------------------
  console.log(`\n${"─".repeat(48)}`);
  console.log(`judge-sim: ${passed} passed, ${failed} failed → ${failed === 0 ? "PASS ✅" : "FAIL ❌"}\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`judge-sim crashed: ${err}`);
  process.exit(1);
});
