import type { SessionState } from "@/lib/types";

/**
 * Session persistence boundary (TRD §6). The judge's multi-turn test is keyed
 * by sessionId, so state must survive across requests. Upstash Redis implements
 * this same interface next; tonight's in-memory Map covers local dev and the
 * night-one deploy.
 */
export interface SessionStore {
  get(sessionId: string): Promise<SessionState | null>;
  set(sessionId: string, state: SessionState, ttlSeconds?: number): Promise<void>;
  delete(sessionId: string): Promise<void>;
}

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

// Anchored on globalThis so dev HMR and per-route module evaluation share one instance.
const g = globalThis as typeof globalThis & { __vivaSessionStore?: SessionStore };

export function getSessionStore(): SessionStore {
  if (!g.__vivaSessionStore) {
    g.__vivaSessionStore = new InMemorySessionStore();
  }
  return g.__vivaSessionStore;
}
