"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { journeyOf, dayTitleFor } from "@/lib/journey";
import type { Candidate, Feedback } from "@/lib/types";
import { MindPanel, type SessionView } from "@/components/mind-panel";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type Exchange = {
  role: "interviewer" | "candidate";
  text: string;
  day?: number;
  difficulty?: number;
};

export function InterviewRoom({
  sessionId,
  candidate: initialCandidate,
}: {
  sessionId: string;
  candidate: Candidate | null;
}) {
  const [candidate, setCandidate] = useState<Candidate | null>(initialCandidate);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(true);
  const [done, setDone] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [view, setView] = useState<SessionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const liveRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const marks = candidate ? journeyOf(candidate) : [];

  const refreshMind = useCallback(async () => {
    try {
      const res = await fetch(`/api/session/${sessionId}`, { cache: "no-store" });
      if (!res.ok) return;
      setView((await res.json()) as SessionView);
    } catch {
      // The Mind panel is an enhancement, the conversation carries on without it.
    }
  }, [sessionId]);

  // Start the interview once, on mount.
  useEffect(() => {
    if (started.current) return;
    started.current = true;

    let resolved = candidate;
    if (!resolved) {
      try {
        const raw = sessionStorage.getItem(`viva:candidate:${sessionId}`);
        if (raw) {
          resolved = JSON.parse(raw) as Candidate;
          setCandidate(resolved);
        }
      } catch {
        resolved = null;
      }
    }

    (async () => {
      try {
        const res = await fetch("/api/interview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, candidate: resolved ?? {} }),
        });
        const data = await res.json();
        setExchanges([{ role: "interviewer", text: data.reply }]);
      } catch {
        setError("Viva could not be reached. Check your connection and reload.");
      } finally {
        setThinking(false);
        refreshMind();
      }
    })();
  }, [sessionId, candidate, refreshMind]);

  const send = useCallback(async () => {
    const message = draft.trim();
    if (!message || thinking || done) return;

    setExchanges((prev) => [...prev, { role: "candidate", text: message }]);
    setDraft("");
    setThinking(true);
    setError(null);

    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message }),
      });
      const data = await res.json();
      setExchanges((prev) => [...prev, { role: "interviewer", text: data.reply }]);
      if (data.done) {
        setDone(true);
        setFeedback(data.feedback ?? null);
      }
    } catch {
      setError("That answer did not reach Viva. Try sending it again.");
    } finally {
      setThinking(false);
      refreshMind();
    }
  }, [draft, thinking, done, sessionId, refreshMind]);

  // Keep the newest exchange in view without yanking the page mid read.
  useEffect(() => {
    liveRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [exchanges.length, done]);

  useEffect(() => {
    if (!thinking && !done) composerRef.current?.focus();
  }, [thinking, done]);

  const name = candidate?.member?.name ?? "Custom candidate";
  const role = candidate?.member?.jobRole;

  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 pb-40 sm:px-8 lg:pb-16">
      <h1 className="sr-only">
        Technical interview with {name}
        {role ? `, ${role}` : ""}
      </h1>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule py-4">
        <div className="flex items-baseline gap-3">
          <Link
            href="/"
            className="font-voice text-[1.25rem] text-ink transition-colors hover:text-quill"
          >
            Viva
          </Link>
          <span className="text-ui-sm text-dim">
            {name}
            {role && <span className="text-faint"> · {role}</span>}
          </span>
        </div>
        <span className="font-mono text-data text-faint">
          session {sessionId.slice(0, 8)}
        </span>
      </header>

      <div className="grid gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12">
        {/* The conversation: page prose, not a chat transcript */}
        <div>
          <ol className="space-y-9">
            {exchanges.map((x, i) =>
              x.role === "interviewer" ? (
                <li key={i}>
                  <QuestionMeta index={i} view={view} exchanges={exchanges} />
                  <p className="voice mt-2">{x.text}</p>
                </li>
              ) : (
                <li key={i} className="border-l border-rule pl-5">
                  <p className="field-label">Your answer</p>
                  <p className="mt-1.5 max-w-[62ch] whitespace-pre-wrap text-body text-dim">
                    {x.text}
                  </p>
                </li>
              ),
            )}

            {thinking && (
              <li aria-live="polite">
                <p className="font-mono text-data text-faint">
                  {exchanges.length === 0
                    ? "reading the candidate's 31 days"
                    : "considering that answer"}
                  <span className="animate-pulse">...</span>
                </p>
              </li>
            )}
          </ol>

          {error && (
            <p role="alert" className="mt-6 border border-lamp-dim px-4 py-3 text-ui text-lamp">
              {error}
            </p>
          )}

          {done && feedback && <ReportCard sessionId={sessionId} feedback={feedback} />}

          <div ref={liveRef} />

          {/* The composer: a ruled writing surface, not a chat input */}
          {!done && (
            <div className="mt-10 border-t border-rule pt-5">
              <label htmlFor="answer" className="field-label">
                Your answer
              </label>
              <textarea
                id="answer"
                ref={composerRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    send();
                  }
                }}
                disabled={thinking}
                rows={4}
                placeholder="Answer in your own words. Say so plainly if you do not know."
                className="mt-2 w-full resize-y border border-rule bg-raised p-3.5 text-body text-ink outline-none transition-colors focus-visible:border-quill disabled:opacity-60"
              />
              <div className="mt-3 flex items-center justify-between gap-4">
                <span className="font-mono text-data text-faint">
                  Ctrl or Cmd plus Enter to send
                </span>
                <button
                  type="button"
                  onClick={send}
                  disabled={thinking || draft.trim().length === 0}
                  className="min-h-11 bg-quill-bright px-5 py-2 text-ui font-medium text-ground transition-opacity hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {thinking ? "Sending" : "Send answer"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* The Mind panel: sticky beside the conversation on desktop */}
        <div className="hidden lg:block">
          <div className="sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto">
            <MindPanel view={view} marks={marks} thinking={thinking} />
          </div>
        </div>
      </div>

      {/* Mobile: a persistent summary bar that opens the full panel */}
      <MobileMind view={view} marks={marks} thinking={thinking} />
    </div>
  );
}

/** The small meta line above each question: which day, why, at what depth. */
function QuestionMeta({
  index,
  view,
  exchanges,
}: {
  index: number;
  view: SessionView | null;
  exchanges: Exchange[];
}) {
  // Question n is the nth interviewer turn, which lines up with reasoning[n].
  const questionNumber = exchanges.slice(0, index + 1).filter((x) => x.role === "interviewer").length;
  const entry = view?.reasoning?.[questionNumber - 1];
  if (!entry) {
    return <p className="field-label">Question {questionNumber}</p>;
  }
  return (
    <p className="font-mono text-data text-dim">
      <span className="text-faint">Q{questionNumber}</span>
      <span className="text-faint"> · </span>
      <span className="text-quill">Day {entry.day}</span>
      <span className="text-faint"> · {dayTitleFor(entry.day)}</span>
      <span className="text-faint"> · L{entry.difficulty}</span>
    </p>
  );
}

function ReportCard({
  sessionId,
  feedback,
}: {
  sessionId: string;
  feedback: Feedback;
}) {
  return (
    <section className="mt-10 border border-rule bg-panel">
      <div className="border-b border-rule px-5 py-4">
        <h2 className="font-voice text-[1.25rem] text-ink">Interview complete</h2>
      </div>
      <div className="space-y-5 px-5 py-5">
        <p className="max-w-[62ch] font-voice text-[1.0625rem] leading-relaxed text-ink">
          {feedback.summary}
        </p>
        <FeedbackList title="Strengths" items={feedback.strengths} tone="quill" />
        <FeedbackList title="Gaps" items={feedback.gaps} tone="lamp" />
        <FeedbackList title="What to do next" items={feedback.next} tone="dim" />
        <Link
          href={`/report/${sessionId}`}
          className="inline-block bg-quill-bright px-5 py-2 text-ui font-medium text-ground transition-opacity hover:opacity-90"
        >
          Open the full report
        </Link>
      </div>
    </section>
  );
}

function FeedbackList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "quill" | "lamp" | "dim";
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="field-label">{title}</h3>
      <ul className="mt-2 space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="grid grid-cols-[0.75rem_1fr] gap-2 text-ui text-ink">
            <span
              aria-hidden
              className={cn(
                "font-mono leading-6",
                tone === "quill" && "text-quill",
                tone === "lamp" && "text-lamp",
                tone === "dim" && "text-faint",
              )}
            >
              {tone === "quill" ? "+" : tone === "lamp" ? "!" : "›"}
            </span>
            <span className="max-w-[62ch]">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MobileMind({
  view,
  marks,
  thinking,
}: {
  view: SessionView | null;
  marks: Parameters<typeof MindPanel>[0]["marks"];
  thinking: boolean;
}) {
  const current = view?.current;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-panel/95 backdrop-blur lg:hidden">
      <Sheet>
        <SheetTrigger className="flex w-full items-center justify-between gap-4 px-5 py-3 text-left">
          <span className="min-w-0">
            <span className="field-label">Interviewer mind</span>
            <span className="mt-0.5 block truncate text-ui-sm text-ink">
              {current
                ? `Day ${current.day} · ${current.module}`
                : "Planning the interview"}
            </span>
          </span>
          <span className="shrink-0 font-mono text-data text-quill">
            {view?.coverage?.distinct ?? 0}/{view?.coverage?.required ?? 4} days
          </span>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] overflow-y-auto border-rule bg-ground p-0"
        >
          <SheetTitle className="sr-only">Interviewer reasoning</SheetTitle>
          <MindPanel view={view} marks={marks} thinking={thinking} className="border-0" />
        </SheetContent>
      </Sheet>
    </div>
  );
}
