import { Redis } from "@upstash/redis";

/**
 * Show of Hands: poll creator with live results.
 * Built live during the Top 8 challenge, 14 Aug 2026.
 *
 * Server side state so results are genuinely live across devices, reusing the
 * same Upstash Redis the interview engine already runs on, with the same
 * in memory fallback so local dev needs zero setup.
 */

export type Poll = {
  id: string;
  question: string;
  options: string[];
  votes: number[];
  /** Voter tokens that have already voted, for server side double vote rejection. */
  voters: string[];
  closed: boolean;
  createdAt: string;
  /** Only the creator may close the poll. */
  creatorToken: string;
};

export type PollView = {
  id: string;
  question: string;
  options: string[];
  votes: number[];
  total: number;
  closed: boolean;
  createdAt: string;
};

const TTL_SECONDS = 7 * 24 * 60 * 60;

function redis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  if (url.includes("your-") || token.startsWith("your-")) return null;
  return new Redis({ url, token });
}

const g = globalThis as typeof globalThis & { __vivaPolls?: Map<string, Poll> };
function memory(): Map<string, Poll> {
  if (!g.__vivaPolls) g.__vivaPolls = new Map();
  return g.__vivaPolls;
}

const key = (id: string) => `viva:poll:${id}`;

export async function savePoll(poll: Poll): Promise<void> {
  const client = redis();
  if (client) await client.set(key(poll.id), poll, { ex: TTL_SECONDS });
  else memory().set(poll.id, poll);
}

export async function readPoll(id: string): Promise<Poll | null> {
  const client = redis();
  if (client) return (await client.get<Poll>(key(id))) ?? null;
  return memory().get(id) ?? null;
}

/** Public shape: never leaks voter tokens or the creator token. */
export function toView(poll: Poll): PollView {
  return {
    id: poll.id,
    question: poll.question,
    options: poll.options,
    votes: poll.votes,
    total: poll.votes.reduce((a, b) => a + b, 0),
    closed: poll.closed,
    createdAt: poll.createdAt,
  };
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 8);
}
