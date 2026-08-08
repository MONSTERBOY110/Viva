import type { Candidate, Feedback } from "@/lib/types";

/**
 * Night-one canned interview script: keeps POST /api/interview contract-exact
 * on the live URL while the real engine (planner + adaptive turn pipeline,
 * TRD §5) replaces this module in the next build.
 *
 * 8 questions across 8 distinct curriculum days (minimum requirement: ≥8 questions, ≥4 days).
 */
export const CANNED_QUESTIONS: { day: number; q: string }[] = [
  {
    day: 7,
    q: "Let's start with foundations, from Day 7: in your own words, what does an embedding actually represent, and why does similarity between two embeddings tell us something useful?",
  },
  {
    day: 8,
    q: "You worked with vector databases on Day 8, when is a plain SQL database the wrong tool for retrieval, and what does a vector database do differently under the hood?",
  },
  {
    day: 11,
    q: "Walk me through a RAG pipeline like your Day 11 build, end to end: from the user's question to the grounded answer. Where can it silently go wrong?",
  },
  {
    day: 12,
    q: "From your Day 12 prompt engineering work, give me one concrete case where few-shot examples beat a zero-shot instruction, and one case where they'd backfire.",
  },
  {
    day: 20,
    q: "On conversation memory, Day 20: your chat history has grown past the context window. What exactly do you keep, summarize, or drop, and why?",
  },
  {
    day: 22,
    q: "Day 22, multi-agent orchestration: when does splitting work across multiple agents genuinely beat one capable agent with good tools? Give a real scenario.",
  },
  {
    day: 23,
    q: "Explain MCP from Day 23 to a backend engineer who has never seen it: what problem does it standardize, and what does an MCP server actually expose?",
  },
  {
    day: 27,
    q: "Last one, on Day 27 security: your chatbot feeds free-text user input to an LLM with tool access. Name two concrete attack vectors and how you'd guard against each.",
  },
];

export const TOTAL_QUESTIONS = CANNED_QUESTIONS.length;

export function cannedWelcome(candidate: Candidate): string {
  const name = candidate?.member?.name?.trim();
  const role = candidate?.member?.jobRole?.trim();
  const greeting = name ? `Welcome, ${name}` : "Welcome";
  const journeyLine = role
    ? ` I've read through your 31-day cohort journey, your background as a ${role} will make this interesting.`
    : " I've read through your 31-day cohort journey.";
  return `${greeting}, I'm Viva, your technical interviewer.${journeyLine} We'll work through ${TOTAL_QUESTIONS} questions across the curriculum; take your time with each answer.`;
}

export function cannedFeedback(candidate: Candidate): Feedback {
  const name = candidate?.member?.name?.trim() ?? "The candidate";
  return {
    summary: `${name} completed the full ${TOTAL_QUESTIONS}-question screening spanning embeddings, vector search, RAG, prompting, conversation memory, multi-agent systems, MCP and security. Per-answer adaptive scoring arrives in the next build; this report confirms full coverage of the interview loop.`,
    strengths: [
      "Engaged with every question across all eight covered curriculum days",
      "Maintained the conversation end to end without losing session context",
    ],
    gaps: [
      "Answer depth not yet individually scored, adaptive evaluation lands in the next build",
    ],
    next: [
      "Revisit Day 11 (RAG End-to-End) and Day 23 (MCP), the cohort's spine topics",
      "Return for a re-interview once adaptive scoring is live for evidence-linked feedback",
    ],
  };
}
