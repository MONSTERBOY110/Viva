"use client";

import { useState } from "react";
import type { Candidate } from "@/lib/types";
import { cn } from "@/lib/utils";

type Call = {
  label: string;
  request: unknown;
  status: number | null;
  body: unknown;
  ms: number;
  error?: string;
};

/**
 * Live proof of contract compliance. Every call here hits the same
 * POST /api/interview a judge's own test harness would hit, and the raw
 * response is printed unedited.
 */
export function ContractPlayground({ candidates }: { candidates: Candidate[] }) {
  const [candidateId, setCandidateId] = useState(
    candidates[0]?.member?.id ?? "",
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState(
    "A vector database stores embeddings and searches by similarity, SQL needs exact predicates.",
  );

  const lastBody = calls.at(-1)?.body as { done?: boolean } | undefined;
  const finished = lastBody?.done === true;

  async function call(label: string, payload: Record<string, unknown>) {
    setBusy(true);
    const started = performance.now();
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
      setCalls((prev) => [
        ...prev,
        {
          label,
          request: payload,
          status: res.status,
          body,
          ms: Math.round(performance.now() - started),
        },
      ]);
    } catch (err) {
      setCalls((prev) => [
        ...prev,
        {
          label,
          request: payload,
          status: null,
          body: null,
          ms: Math.round(performance.now() - started),
          error: String(err),
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function start() {
    const id = crypto.randomUUID();
    setSessionId(id);
    setCalls([]);
    const candidate = candidates.find((c) => c.member?.id === candidateId);
    call("Start", { sessionId: id, candidate });
  }

  return (
    <div className="border border-rule bg-panel">
      <div className="flex flex-wrap items-end gap-4 border-b border-rule p-4">
        <div>
          <label htmlFor="pg-candidate" className="field-label">
            Candidate
          </label>
          <select
            id="pg-candidate"
            value={candidateId}
            onChange={(e) => setCandidateId(e.target.value)}
            className="mt-1.5 block border border-rule bg-ground px-3 py-2 font-mono text-ui-sm text-ink outline-none focus-visible:border-quill"
          >
            {candidates.map((c) => (
              <option key={c.member!.id} value={c.member!.id}>
                {c.member!.id} · {c.member!.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={start}
          disabled={busy}
          className="bg-quill-bright px-4 py-2 text-ui font-medium text-ground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy && calls.length === 0 ? "Sending" : "Send start request"}
        </button>
        {sessionId && (
          <span className="font-mono text-data text-faint">
            sessionId {sessionId.slice(0, 8)}
          </span>
        )}
      </div>

      {sessionId && !finished && (
        <div className="flex flex-wrap items-end gap-3 border-b border-rule p-4">
          <div className="min-w-0 flex-1">
            <label htmlFor="pg-answer" className="field-label">
              message
            </label>
            <input
              id="pg-answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="mt-1.5 w-full border border-rule bg-ground px-3 py-2 font-mono text-ui-sm text-ink outline-none focus-visible:border-quill"
            />
          </div>
          <button
            type="button"
            onClick={() => call("Turn", { sessionId, message: answer })}
            disabled={busy}
            className="border border-rule bg-raised px-4 py-2 text-ui text-ink transition-colors hover:border-quill disabled:opacity-40"
          >
            Send turn
          </button>
        </div>
      )}

      {calls.length === 0 ? (
        <p className="p-4 text-ui text-dim">
          Nothing sent yet. Pick a candidate and send the start request, then
          send turns until <code className="font-mono text-quill">done</code>{" "}
          comes back true. Responses below are printed exactly as the endpoint
          returned them.
        </p>
      ) : (
        <ol className="divide-y divide-rule-soft">
          {calls.map((c, i) => (
            <li key={i} className="p-4">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="font-mono text-data text-dim">
                  {i + 1}. {c.label}
                </span>
                <span
                  className={cn(
                    "font-mono text-data",
                    c.status && c.status < 300
                      ? "text-quill"
                      : c.status && c.status < 500
                        ? "text-lamp"
                        : "text-destructive",
                  )}
                >
                  HTTP {c.status ?? "network error"}
                </span>
                <span className="font-mono text-data text-faint">{c.ms}ms</span>
              </div>
              <pre className="mt-2 overflow-x-auto border border-rule-soft bg-ground p-3 font-mono text-[0.75rem] leading-relaxed text-ink">
                {JSON.stringify(c.body ?? c.error, null, 2)}
              </pre>
            </li>
          ))}
        </ol>
      )}

      {finished && (
        <p className="border-t border-rule px-4 py-3 font-mono text-data text-quill">
          done: true, with a feedback object carrying summary, strengths, gaps
          and next.
        </p>
      )}
    </div>
  );
}
