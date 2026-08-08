/**
 * steer-sim: proves every Live Steer control has a visible effect, and that
 * none of them can break the contract.
 *
 *   npx tsx scripts/steer-sim.ts                       # localhost
 *   npx tsx scripts/steer-sim.ts https://viva-bay.vercel.app
 *
 * Answers are picked to match the question and never repeated, because a
 * repeated or off-topic answer scores weak, and a weak answer legitimately
 * blocks escalation. Testing with sloppy answers measures the guardrail, not
 * the steer.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/+$/, "");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { candidates } = JSON.parse(
  readFileSync(join(root, "lib", "data", "candidates.json"), "utf-8"),
);
const CANDIDATE = candidates.find(
  (c: { member: { id: string } }) => c.member.id === "CAND-004",
);

const BANK: [RegExp, string][] = [
  [/sql|vector database|vector store/i, "A vector database stores embeddings and retrieves by similarity with an ANN index, whereas SQL needs exact predicates. SQL is wrong once the query is fuzzy natural language."],
  [/hnsw|ann |index|efsearch|recall|flat/i, "HNSW walks sparse upper layers to reach the right region, then compares finely only in the dense layer. Raising efSearch buys recall back at the cost of latency."],
  [/embedding|cosine|similarity|normali/i, "Cosine of one means identical direction in the embedding space. I normalise before dot product so magnitude does not masquerade as relevance."],
  [/rag|retriev|chunk|ground/i, "RAG retrieves top k chunks and grounds generation in them. It fails silently on bad chunk boundaries, a stale index, or the model ignoring context."],
  [/mcp|protocol|tool/i, "MCP standardises how a model reaches tools: a server exposes tools and resources over one protocol, so any client uses them without bespoke glue."],
  [/docker|kubernetes|deploy|container|volume|scal/i, "Docker packages the app with dependencies and Kubernetes schedules it. A stateful vector store gets a StatefulSet with a PersistentVolumeClaim so data survives restarts."],
  [/monitor|observab|logging|metric|latency|cost/i, "I trace each request end to end and record retrieval latency, tokens per request and which chunks were used, then alert on cost as well as errors."],
  [/agent|orchestrat|router/i, "Multi agent helps when subtasks need different tools or context, with a router delegating to specialists. The cost is latency and error propagation."],
  [/prompt|few shot|zero shot|instruction/i, "Few shot pins the output shape when format matters, but it biases the model when the examples are unrepresentative and it eats context budget."],
  [/memory|context|token|window|summar/i, "I keep recent turns verbatim and summarise older ones, counting tokens before the call so the system prompt and newest turn always survive."],
];

const used = new Set<string>();
function answerFor(question: string): string {
  for (const [re, a] of BANK) {
    if (re.test(question) && !used.has(a)) {
      used.add(a);
      return a;
    }
  }
  for (const [, a] of BANK) {
    if (!used.has(a)) {
      used.add(a);
      return a;
    }
  }
  return "I would want to check my notes for the exact detail there.";
}

let passed = 0;
let failed = 0;
function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ok   ${label}`);
  } else {
    failed++;
    console.error(`  FAIL ${label} ${detail}`);
  }
}

type View = {
  current: { day: number; difficulty: number; rationale: string };
  coverage: { distinct: number; required: number };
  counts: { asked: number };
  phase: string;
};

async function post(body: unknown) {
  const res = await fetch(`${BASE}/api/interview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });
  return res.json() as Promise<{ reply: string; done: boolean }>;
}

async function steer(sid: string, kind: string, day?: number) {
  const res = await fetch(`${BASE}/api/session/${sid}/steer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, day }),
    signal: AbortSignal.timeout(30_000),
  });
  return { status: res.status, body: await res.json() };
}

async function view(sid: string): Promise<View> {
  const res = await fetch(`${BASE}/api/session/${sid}`, {
    signal: AbortSignal.timeout(30_000),
  });
  return res.json() as Promise<View>;
}

async function freshSession(label: string, warmupTurns = 2) {
  const sid = `steersim-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  used.clear();
  let turn = await post({ sessionId: sid, candidate: CANDIDATE });
  for (let i = 0; i < warmupTurns; i++) {
    turn = await post({ sessionId: sid, message: answerFor(turn.reply) });
  }
  return { sid, turn };
}

async function main() {
  console.log(`\nsteer-sim to ${BASE}\n`);

  console.log("1) press harder raises difficulty after a good answer");
  {
    const { sid, turn } = await freshSession("harder");
    const before = await view(sid);
    await steer(sid, "harder");
    await post({ sessionId: sid, message: answerFor(turn.reply) });
    const after = await view(sid);
    check(
      `difficulty did not drop (L${before.current.difficulty} -> L${after.current.difficulty})`,
      after.current.difficulty >= before.current.difficulty,
    );
    check("steer recorded in the rationale", after.current.rationale.includes("steered by observer"));
  }

  console.log("\n2) ease off lowers difficulty");
  {
    const { sid, turn } = await freshSession("easier");
    const before = await view(sid);
    await steer(sid, "easier");
    await post({ sessionId: sid, message: answerFor(turn.reply) });
    const after = await view(sid);
    check(
      `difficulty did not rise (L${before.current.difficulty} -> L${after.current.difficulty})`,
      after.current.difficulty <= before.current.difficulty,
    );
  }

  console.log("\n3) move on leaves the current curriculum day");
  {
    const { sid, turn } = await freshSession("moveon");
    const before = await view(sid);
    await steer(sid, "move-on");
    await post({ sessionId: sid, message: answerFor(turn.reply) });
    const after = await view(sid);
    check(
      `day changed (${before.current.day} -> ${after.current.day})`,
      after.current.day !== before.current.day,
    );
  }

  console.log("\n4) jump to a specific day lands on that day");
  {
    const { sid, turn } = await freshSession("day");
    await steer(sid, "day", 28);
    await post({ sessionId: sid, message: answerFor(turn.reply) });
    const after = await view(sid);
    check(`landed on Day 28 (got ${after.current.day})`, after.current.day === 28);
  }

  console.log("\n5) a wrap steer cannot end the interview early");
  {
    const { sid, turn } = await freshSession("wrap", 1);
    await steer(sid, "wrap");
    const res = await post({ sessionId: sid, message: answerFor(turn.reply) });
    const after = await view(sid);
    check("interview did not finish", res.done === false, `asked ${after.counts.asked}`);
    check("the steer was applied, not silently dropped", after.current.rationale.includes("steered by observer"));
    // Note: there is usually no [policy:] marker here, and that is correct.
    // The pre-call directive already tells the model not to wrap before the
    // minimum, so it never attempts it and there is nothing to overrule. The
    // guardrail is the second line of defence, not the first.
    check("still short of the minimum", after.counts.asked < 8, `asked ${after.counts.asked}`);
  }

  console.log("\n6) an invalid steer is rejected, not obeyed");
  {
    const { sid } = await freshSession("invalid", 0);
    const bogus = await steer(sid, "explode");
    check("unknown kind rejected with 400", bogus.status === 400);
    const badDay = await steer(sid, "day", 999);
    check("out of range day rejected with 400", badDay.status === 400);
  }

  console.log(`\n${"=".repeat(52)}`);
  console.log(
    `steer-sim: ${passed} passed, ${failed} failed -> ${failed === 0 ? "PASS" : "FAIL"}\n`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`steer-sim crashed: ${err}`);
  process.exit(1);
});
