import { Redis } from "@upstash/redis";
import type { SessionState } from "@/lib/types";

/**
 * Session persistence boundary (TRD §6). The judge's multi-turn test is keyed
 * by sessionId, so state must survive across requests — including across
 * serverless instances, which is why production uses Upstash Redis.
 * Falls back to an in-memory Map when Redis env vars are absent (local dev),
 * so the app is always runnable.
 */
export interface SessionStore {
  get(sessionId: string): Promise<SessionState | null>;
  set(sessionId: string, state: SessionState, ttlSeconds?: number): Promise<void>;
  delete(sessionId: string): Promise<void>;
}

/** Sessions outlive the whole judging window comfortably. */
const SESSION_TTL_SECONDS = 48 * 60 * 60;

class InMemorySessionStore implements SessionStore {
  private sessions = new Map<string, SessionState>();

  async get(sessionId: string): Promise<SessionState | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async set(sessionId: string, state: SessionState): Promise<void> {
    this.sessions.set(sessionId, state);
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
}

class RedisSessionStore implements SessionStore {
  constructor(private redis: Redis) {}

  private key(sessionId: string): string {
    return `viva:session:${sessionId}`;
  }

  async get(sessionId: string): Promise<SessionState | null> {
    return (await this.redis.get<SessionState>(this.key(sessionId))) ?? null;
  }

  async set(
    sessionId: string,
    state: SessionState,
    ttlSeconds: number = SESSION_TTL_SECONDS,
  ): Promise<void> {
    await this.redis.set(this.key(sessionId), state, { ex: ttlSeconds });
  }

  async delete(sessionId: string): Promise<void> {
    await this.redis.del(this.key(sessionId));
  }
}

// The Vercel Marketplace integration injects UPSTASH_*; older Vercel KV
// setups inject KV_REST_API_* — accept either so provisioning can't miss.
function redisCredentials(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

/** Which backend the store is using — surfaced on /api/health for ops sanity. */
export function sessionStoreKind(): "redis" | "memory" {
  return redisCredentials() ? "redis" : "memory";
}

function createStore(): SessionStore {
  const creds = redisCredentials();
  if (creds) {
    return new RedisSessionStore(new Redis(creds));
  }
  return new InMemorySessionStore();
}

// Anchored on globalThis so dev HMR and per-route module evaluation share one instance.
const g = globalThis as typeof globalThis & { __vivaSessionStore?: SessionStore };

export function getSessionStore(): SessionStore {
  if (!g.__vivaSessionStore) {
    g.__vivaSessionStore = createStore();
  }
  return g.__vivaSessionStore;
}
