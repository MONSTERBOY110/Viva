/**
 * rehearse: run a full interview against any deployment and print it the way
 * a judge would read it, so quality problems surface rather than just status
 * codes.
 *
 *   npx tsx scripts/rehearse.ts CAND-001
 *   npx tsx scripts/rehearse.ts CAND-004 https://viva-bay.vercel.app
 *   npx tsx scripts/rehearse.ts custom
 *
 * Answers are chosen to exercise the adaptive paths: a couple of strong ones,
 * an honest "I don't know", an evasive non-answer, and a weak one.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const arg = process.argv[2] ?? "CAND-004";
const BASE = (process.argv[3] ?? "http://localhost:3000").replace(/\/+$/, "");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { candidates } = JSON.parse(
  readFileSync(join(root, "lib", "data", "candidates.json"), "utf-8"),
);

/** A pasted candidate a judge might invent: sparse, contradictory, odd role. */
const CUSTOM = {
  member: {
    id: "CAND-777",
    name: "Priya Raman",
    jobRole: "Product Manager",
    yearsExperience: 11,
    education: "MBA",
    status: "COMPLETED",
  },
  missions: [
    { day: 7, title: "Embeddings Explained", passed: true, attempts: 5 },
    { day: 12, title: "Prompt Engineering Fundamentals", passed: true, attempts: 1 },
    { day: 22, title: "Multi-Agent Orchestration", passed: false, attempts: 3 },
    { day: 27, title: "Security, Privacy & Guardrails", skipped: true },
    { day: 31, title: "Capstone Project & Final Demo", passed: true, attempts: 2 },
  ],
  signals: { commitDays: 14, missionsCompleted: 18, missionsFirstTry: 4 },
};

/**
 * A candidate who actually listens. Answers are chosen by matching the
 * question, because firing a fixed list in order produces a transcript of
 * non-sequiturs and the model correctly scores every one of them as evasive,
 * which tests nothing except the evasion path.
 */
const ANSWER_BANK: { keys: RegExp; answer: string }[] = [
  {
    keys: /hnsw|ann |approximate nearest|index|ivf|efsearch|recall/i,
    answer:
      "HNSW builds a multi layer proximity graph. A query walks the sparse top layers to get close to the right region, then only does fine comparisons in the dense bottom layer, so you skip most of the corpus. The trade off is recall against efSearch, and build time against M.",
  },
  {
    keys: /sql|vector database|vector store|chroma|pinecone|weaviate|retrieval engine/i,
    answer:
      "A vector database stores embeddings and retrieves by similarity with an ANN index, whereas SQL needs exact predicates or full scans. SQL is the wrong tool the moment the query is fuzzy natural language rather than a filter.",
  },
  {
    keys: /embedding|cosine|similarity|dimension|normali/i,
    answer:
      "An embedding is a dense vector where distance encodes semantic closeness, so cosine similarity of one means the same direction in that space. You normalise vectors when using dot product so magnitude does not masquerade as relevance.",
  },
  {
    keys: /chunk|truncat|token budget|window|context management|memory/i,
    answer:
      "I keep the recent turns verbatim and summarise older ones, and I chunk on semantic boundaries with a small overlap. Before the call I count tokens and drop the lowest scoring retrieved chunks first, so the system prompt and the newest turn always survive.",
  },
  {
    keys: /rag|retriev|ground|hallucinat/i,
    answer:
      "RAG retrieves the top k chunks and grounds the answer in them. It fails quietly when chunking splits an idea in half, when the index is stale, or when the model ignores the context and answers from memory, so I log retrieved chunk ids next to the answer.",
  },
  {
    keys: /mcp|model context protocol|tool.*(expos|standard)|function calling/i,
    answer:
      "MCP standardises how a model reaches external capability. A server exposes tools, resources and prompts over one protocol, so any compatible client can use them instead of every model needing a bespoke integration per tool.",
  },
  {
    keys: /security|injection|exfiltrat|guardrail|privacy|prompt attack/i,
    answer:
      "The two that worry me are prompt injection through untrusted retrieved text and data exfiltration through tool calls. I validate and quarantine retrieved content, give tools least privilege, and filter outputs before they reach another system.",
  },
  {
    keys: /prompt engineer|few shot|zero shot|system prompt|instruction/i,
    answer:
      "Few shot earns its place when the output shape matters, like structured extraction, because examples pin the format better than description does. It backfires when the examples are unrepresentative, since the model copies their bias, and they consume budget I would rather spend on retrieved context.",
  },
  {
    keys: /docker|kubernetes|deploy|container|pod|volume|rollout|scal/i,
    answer:
      "Docker packages the app with its dependencies so the runtime is identical everywhere, and Kubernetes schedules and scales those containers. For a stateful vector database I bind a PersistentVolumeClaim through a StatefulSet so the data survives pod restarts, and I roll out gradually with readiness probes.",
  },
  {
    keys: /agent|orchestrat|multi.?agent|router|handoff/i,
    answer:
      "Multi agent helps when subtasks need genuinely different context or tools, so a router delegates to specialists rather than one prompt carrying everything. The cost is latency and error propagation, so I keep the handoff contract explicit and typed.",
  },
  {
    keys: /monitor|observab|logging|metric|trace|latency|cost/i,
    answer:
      "I trace every request end to end, and for a RAG pipeline I record retrieval latency, tokens per request and which chunks were used. That last one is what lets you debug a bad answer later, and I alert on cost per request as well as errors.",
  },
  {
    keys: /fine.?tun|lora|qlora|adapter|training/i,
    answer:
      "Fine tuning changes behaviour and format, retrieval changes knowledge. I reach for RAG when the facts move, and only fine tune when I need a consistent style or a narrow task the base model keeps getting wrong.",
  },
  {
    keys: /stream|response format|rich output|frontend|ui/i,
    answer:
      "I stream tokens so the first words appear immediately rather than after the full generation, which changes the perceived latency completely. The client renders progressively and I keep the final structured payload separate from the streamed prose.",
  },
];

/** Deliberate imperfections, so the adaptive paths are actually exercised. */
const HONEST_DONT_KNOW =
  "I do not know that one, honestly. I used the library defaults and never dug into the internals.";
const EVASIVE =
  "That is a really interesting area with a lot of considerations, and it depends a great deal on the specific context and the requirements involved.";
const FALLBACK =
  "I built that during the cohort. I wired the pieces together and got it working, though I would want to look at my notes for the exact details.";

function answerFor(question: string, index: number): string {
  // Question 3 is answered honestly with a gap, question 5 evasively, so the
  // rehearsal proves the kind pivot and the evasion handling still fire.
  if (index === 3) return HONEST_DONT_KNOW;
  if (index === 5) return EVASIVE;
  const hit = ANSWER_BANK.find((a) => a.keys.test(question));
  return hit ? hit.answer : FALLBACK;
}

type Reply = { reply: string; done: boolean; feedback?: Record<string, unknown> };

async function post(body: unknown): Promise<Reply> {
  const res = await fetch(`${BASE}/api/interview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  if (res.status >= 500) throw new Error(`HTTP ${res.status} from /api/interview`);
  return (await res.json()) as Reply;
}

function wrap(text: string, indent = "   "): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > 92) {
      lines.push(line.trim());
      line = w;
    } else {
      line += " " + w;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines.map((l) => indent + l).join("\n");
}

async function main() {
  const candidate =
    arg.toLowerCase() === "custom"
      ? CUSTOM
      : candidates.find((c: { member: { id: string } }) => c.member.id === arg);

  if (!candidate) {
    console.error(`Unknown candidate ${arg}`);
    process.exit(1);
  }

  const sessionId = randomUUID();
  const label = `${candidate.member.name} (${candidate.member.id})`;
  console.log(`\n${"=".repeat(96)}`);
  console.log(`REHEARSAL  ${label}  ${candidate.member.jobRole}`);
  console.log(`${BASE}  session ${sessionId.slice(0, 8)}`);
  console.log("=".repeat(96));

  const t0 = Date.now();
  let turn = await post({ sessionId, candidate });
  let n = 1;
  console.log(`\nQ1`);
  console.log(wrap(turn.reply));

  let answerIdx = 0;
  while (!turn.done && n < 16) {
    answerIdx++;
    const answer = answerFor(turn.reply, answerIdx);
    console.log(`\n   > ${answer.slice(0, 88)}${answer.length > 88 ? "..." : ""}`);
    const started = Date.now();
    turn = await post({ sessionId, message: answer });
    const ms = Date.now() - started;
    if (!turn.done) n++;
    console.log(`\n${turn.done ? "CLOSING" : `Q${n}`}   (${ms}ms)`);
    console.log(wrap(turn.reply));
  }

  // The reasoning behind the interview, from the panel's own read model.
  const view = await fetch(`${BASE}/api/session/${sessionId}`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

  console.log(`\n${"-".repeat(96)}`);
  console.log("PLAN AND REASONING");
  console.log("-".repeat(96));
  if (view?.plan) {
    console.log(`persona: ${view.plan.personaNotes}`);
    for (const t of view.plan.topics) {
      console.log(`  Day ${String(t.day).padStart(2)}  ${t.reason.padEnd(16)} ${t.reasonDetail}`);
    }
  }
  if (view?.reasoning) {
    console.log("\nper turn:");
    for (const [i, r] of view.reasoning.entries()) {
      const ev = r.evaluation
        ? `${r.evaluation.classification} ${r.evaluation.score.toFixed(2)}`
        : "unanswered";
      console.log(`  Q${i + 1} Day ${String(r.day).padStart(2)} L${r.difficulty}  ${ev.padEnd(16)} ${r.rationale.slice(0, 60)}`);
    }
  }

  const f = turn.feedback as
    | { summary: string; strengths: string[]; gaps: string[]; next: string[] }
    | undefined;

  console.log(`\n${"-".repeat(96)}`);
  console.log("REPORT");
  console.log("-".repeat(96));
  if (f) {
    console.log(wrap(f.summary, "  "));
    for (const [title, items] of [
      ["STRENGTHS", f.strengths],
      ["GAPS", f.gaps],
      ["NEXT", f.next],
    ] as const) {
      console.log(`\n${title}`);
      for (const item of items) console.log(wrap(item, "  - ").replace("  - ", "  - "));
    }
  } else {
    console.log("  (no feedback returned)");
  }

  const days = view?.coverage?.distinct ?? 0;
  console.log(`\n${"-".repeat(96)}`);
  console.log(
    `VERDICT  questions ${n}  days covered ${days}  elapsed ${Math.round((Date.now() - t0) / 1000)}s`,
  );
  const problems: string[] = [];
  if (n < 8) problems.push(`only ${n} questions, minimum is 8`);
  if (days < 4) problems.push(`only ${days} distinct days, minimum is 4`);
  if (!f) problems.push("no feedback object");
  if (f && (!f.strengths.length || !f.gaps.length || !f.next.length)) {
    problems.push("a feedback array came back empty");
  }
  console.log(problems.length ? `PROBLEMS: ${problems.join("; ")}` : "PROBLEMS: none");
  console.log("-".repeat(96) + "\n");
  process.exit(problems.length ? 1 : 0);
}

main().catch((err) => {
  console.error(`rehearsal failed: ${err}`);
  process.exit(1);
});
