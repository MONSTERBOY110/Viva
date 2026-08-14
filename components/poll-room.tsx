"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { cn } from "@/lib/utils";

/**
 * Vote, then watch the room answer. Results are genuinely live: the server
 * tally is polled every 2 seconds and same browser tabs sync instantly over
 * BroadcastChannel, so a judge voting on their phone moves the presenter's
 * bars in front of them.
 */

type PollView = {
  id: string;
  question: string;
  options: string[];
  votes: number[];
  total: number;
  closed: boolean;
  createdAt: string;
};

function voterToken(): string {
  try {
    let t = localStorage.getItem("soh:voter");
    if (!t) {
      t = crypto.randomUUID();
      localStorage.setItem("soh:voter", t);
    }
    return t;
  } catch {
    return `anon-${Math.random().toString(36).slice(2)}`;
  }
}

/** Numerals count toward their target so movement is visible, not implied. */
function useCountUp(target: number, ms = 500): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    const from = fromRef.current;
    if (from === target) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(from + (target - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

export function PollRoom({ id }: { id: string }) {
  const [poll, setPoll] = useState<PollView | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [votedFor, setVotedFor] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/poll/${id}`, { cache: "no-store" });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const data = await res.json();
      if (data.poll) setPoll(data.poll);
    } catch {
      // Keep showing the last known tallies rather than erroring.
    }
  }, [id]);

  useEffect(() => {
    refresh();
    try {
      setVotedFor(
        localStorage.getItem(`soh:voted:${id}`) !== null
          ? Number(localStorage.getItem(`soh:voted:${id}`))
          : null,
      );
      setIsCreator(localStorage.getItem(`soh:creator:${id}`) !== null);
    } catch {
      // Fine: they can still vote, the server rejects repeats.
    }

    const interval = setInterval(refresh, 2000);
    const channel = new BroadcastChannel(`soh:${id}`);
    channel.onmessage = () => refresh();
    channelRef.current = channel;
    return () => {
      clearInterval(interval);
      channel.close();
    };
  }, [id, refresh]);

  async function vote(option: number) {
    if (busy || votedFor !== null || poll?.closed) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/poll/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option, voter: voterToken() }),
      });
      const data = await res.json();
      if (data.poll) {
        setPoll(data.poll);
        setVotedFor(option);
        try {
          localStorage.setItem(`soh:voted:${id}`, String(option));
        } catch {
          // Server still rejects a repeat from this voter token.
        }
        channelRef.current?.postMessage("voted");
      }
    } finally {
      setBusy(false);
    }
  }

  async function closePoll() {
    try {
      const creatorToken = localStorage.getItem(`soh:creator:${id}`);
      const res = await fetch(`/api/poll/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close", creatorToken }),
      });
      const data = await res.json();
      if (data.poll) setPoll(data.poll);
      channelRef.current?.postMessage("closed");
    } catch {
      // The next refresh shows the truth either way.
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard denied: the URL bar is right there.
    }
  }

  const showResults = votedFor !== null || poll?.closed;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[680px] px-5 pb-24 sm:px-8">
      <header className="flex items-center justify-between border-b border-rule py-5">
        <Link href="/poll" className="group flex items-center gap-2.5">
          <LogoMark className="h-5 w-5 text-quill transition-colors group-hover:text-quill-bright" />
          <span className="font-voice text-[1.25rem] leading-none text-ink">Viva</span>
        </Link>
        <span className="font-mono text-data uppercase tracking-[0.16em] text-faint">
          show of hands
        </span>
      </header>

      {notFound ? (
        <section className="py-14">
          <h1 className="font-voice text-[1.75rem] text-ink">No such poll</h1>
          <p className="mt-3 max-w-[48ch] text-body text-dim">
            This link does not match a live poll. Polls expire after 7 days.
          </p>
          <Link
            href="/poll"
            className="mt-6 inline-block bg-quill-bright px-5 py-2.5 text-ui font-medium text-ground hover:opacity-90"
          >
            Create a new poll
          </Link>
        </section>
      ) : !poll ? (
        <section className="py-14" role="status" aria-live="polite">
          <div className="h-7 w-3/4 animate-pulse bg-raised" />
          <div className="mt-6 space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse bg-raised" />
            ))}
          </div>
        </section>
      ) : (
        <section className="py-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-data text-faint">
              poll {poll.id}
              {poll.closed && <span className="ml-2 text-lamp">closed</span>}
            </p>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={copyLink}
                className="-my-2 py-2 font-mono text-data text-dim underline decoration-rule underline-offset-4 hover:text-quill"
              >
                {copied ? "link copied" : "copy share link"}
              </button>
              {isCreator && !poll.closed && (
                <button
                  type="button"
                  onClick={closePoll}
                  className="-my-2 py-2 font-mono text-data text-lamp underline decoration-lamp-dim underline-offset-4"
                >
                  close poll
                </button>
              )}
            </div>
          </div>

          <h1 className="mt-4 font-voice text-[1.75rem] font-medium leading-tight text-ink">
            {poll.question}
          </h1>
          <p className="mt-1.5 font-mono text-data text-dim" aria-live="polite">
            {poll.total} {poll.total === 1 ? "vote" : "votes"}
            {!poll.closed && <span className="text-faint"> · live</span>}
          </p>

          <div className="mt-7 space-y-2.5">
            {poll.options.map((label, i) =>
              showResults ? (
                <ResultBar
                  key={i}
                  label={label}
                  letter={String.fromCharCode(65 + i)}
                  count={poll.votes[i]}
                  total={poll.total}
                  leading={
                    poll.votes[i] > 0 && poll.votes[i] === Math.max(...poll.votes)
                  }
                  mine={votedFor === i}
                />
              ) : (
                <button
                  key={i}
                  type="button"
                  onClick={() => vote(i)}
                  disabled={busy}
                  className={cn(
                    "group flex min-h-14 w-full items-center gap-4 border border-rule bg-panel px-4 text-left",
                    "transition-colors hover:border-quill focus-visible:border-quill active:bg-raised disabled:opacity-60",
                  )}
                >
                  <span className="font-mono text-data text-faint group-hover:text-quill">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="text-body text-ink">{label}</span>
                </button>
              ),
            )}
          </div>

          {!showResults && (
            <p className="mt-4 text-ui-sm text-faint">
              One vote per person. Results appear the moment you choose.
            </p>
          )}
          {showResults && !poll.closed && (
            <p className="mt-4 text-ui-sm text-faint">
              Share the link and watch new votes land without refreshing.
            </p>
          )}
        </section>
      )}
    </main>
  );
}

function ResultBar({
  label,
  letter,
  count,
  total,
  leading,
  mine,
}: {
  label: string;
  letter: string;
  count: number;
  total: number;
  leading: boolean;
  mine: boolean;
}) {
  const pct = total === 0 ? 0 : (count / total) * 100;
  const shownPct = useCountUp(pct);
  const shownCount = useCountUp(count, 400);

  return (
    <div className="border border-rule-soft bg-panel px-4 py-3">
      <div className="flex items-baseline justify-between gap-4">
        <span className="min-w-0 truncate text-body text-ink">
          <span className="mr-3 font-mono text-data text-faint">{letter}</span>
          {label}
          {mine && <span className="ml-2 font-mono text-data text-quill">your vote</span>}
        </span>
        <span className="shrink-0 font-mono tabular-nums">
          <span
            className={cn(
              "text-[1.375rem]",
              leading ? "text-quill-bright" : "text-ink",
            )}
          >
            {Math.round(shownPct)}%
          </span>
          <span className="ml-2 text-data text-faint">
            {Math.round(shownCount)}
          </span>
        </span>
      </div>
      <div className="mt-2.5 h-2 w-full bg-rule" role="presentation">
        <div
          className={cn(
            "h-full transition-[width] duration-700 ease-out motion-reduce:transition-none",
            leading ? "bg-quill-bright" : "bg-quill-dim",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
