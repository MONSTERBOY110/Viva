"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { journeyOf, dayTitleFor } from "@/lib/journey";
import type { Candidate, Feedback, SteerKind } from "@/lib/types";
import { MindPanel, type SessionView } from "@/components/mind-panel";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useDictation, useExaminerVoice } from "@/components/use-voice";
import { LogoMark } from "@/components/logo";
import { PlanningState } from "@/components/planning-state";
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

  /** Hands-free: the examiner asks aloud, the microphone opens, you answer. */
  const [vivaMode, setVivaMode] = useState(false);
  const sendRef = useRef<() => void>(() => {});

  const voice = useExaminerVoice();
  const dictation = useDictation({
    onChunk: (chunk) => {
      spokenRef2.current = true;
      setDraft((prev) => (prev ? `${prev.trim()} ${chunk}` : chunk));
    },
    // In hands-free mode, going quiet is how you finish an answer.
    onSilence: vivaMode ? () => sendRef.current() : undefined,
    silenceMs: 3000,
  });

  const marks = candidate ? journeyOf(candidate) : [];

  /**
   * Answer telemetry: how the reply arrived, not just what it said. Reset each
   * time a new question appears so every measurement belongs to one answer.
   */
  const askedAt = useRef<number>(Date.now());
  const pastedRef = useRef(false);
  const spokenRef2 = useRef(false);

  /** Live Steer: the observer nudges the examiner before its next question. */
  const [steering, setSteering] = useState<SteerKind | null>(null);
  const steer = useCallback(
    async (kind: SteerKind, day?: number) => {
      setSteering(kind);
      try {
        await fetch(`/api/session/${sessionId}/steer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, day }),
        });
      } catch {
        // A steer that does not land just means the examiner carries on alone.
        setSteering(null);
      }
    },
    [sessionId],
  );

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

  const stopDictation = dictation.stop;
  const send = useCallback(async () => {
    const message = draft.trim();
    if (!message || thinking || done) return;

    stopDictation();
    setExchanges((prev) => [...prev, { role: "candidate", text: message }]);
    setDraft("");
    setThinking(true);
    setError(null);

    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message,
          telemetry: {
            ms: Date.now() - askedAt.current,
            chars: message.length,
            pasted: pastedRef.current,
            spoken: spokenRef2.current,
          },
        }),
      });
      const data = await res.json();
      setExchanges((prev) => [...prev, { role: "interviewer", text: data.reply }]);
      setSteering(null);
      askedAt.current = Date.now();
      pastedRef.current = false;
      spokenRef2.current = false;
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
  }, [draft, thinking, done, sessionId, refreshMind, stopDictation]);

  sendRef.current = send;

  // Speak each new question once, then in hands-free mode open the microphone
  // the moment the examiner stops talking. This lives in an effect rather than
  // beside the fetch because voice availability resolves asynchronously, so
  // the opening question would otherwise be missed on a fresh load.
  const spokenRef = useRef<string | null>(null);
  const { speak, enabled: voiceOn, available: voiceAvailable } = voice;
  const startDictation = dictation.start;
  const dictationSupported = dictation.supported;

  useEffect(() => {
    if (!voiceAvailable || !voiceOn) return;
    const latest = exchanges.at(-1);
    if (!latest || latest.role !== "interviewer") return;
    if (spokenRef.current === latest.text) return;
    spokenRef.current = latest.text;

    let cancelled = false;
    (async () => {
      await speak(latest.text);
      // Never listen while the examiner is still speaking, or the microphone
      // transcribes the question back into the answer.
      if (cancelled || !vivaMode || !dictationSupported) return;
      if (latest.text === spokenRef.current) startDictation();
    })();
    return () => {
      cancelled = true;
    };
  }, [
    exchanges,
    voiceOn,
    voiceAvailable,
    speak,
    vivaMode,
    dictationSupported,
    startDictation,
  ]);

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
          <Link href="/" className="group flex items-center gap-2.5">
            <LogoMark className="h-5 w-5 text-quill transition-colors group-hover:text-quill-bright" />
            <span className="font-voice text-[1.25rem] leading-none text-ink">Viva</span>
          </Link>
          <span className="text-ui-sm text-dim">
            {name}
            {role && <span className="text-faint"> · {role}</span>}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {voice.available && (
            <>
              <button
                type="button"
                onClick={() => voice.setEnabled(!voice.enabled)}
                aria-pressed={voice.enabled}
                className={cn(
                  "-my-2 flex items-center gap-2 py-2 font-mono text-data transition-colors",
                  voice.enabled ? "text-quill" : "text-dim hover:text-ink",
                )}
              >
                <SpeakerIcon on={voice.enabled} speaking={voice.speaking} />
                {voice.speaking ? "speaking" : voice.enabled ? "read aloud" : "silent"}
              </button>

              {voice.enabled && voice.voices.length > 1 && (
                <label className="flex items-center gap-1.5">
                  <span className="sr-only">Examiner voice</span>
                  <select
                    value={voice.voiceId ?? ""}
                    onChange={(e) => voice.setVoice(e.target.value)}
                    className="-my-1 border border-rule bg-panel px-2 py-1 font-mono text-data text-dim outline-none transition-colors hover:text-ink focus-visible:border-quill"
                  >
                    {voice.voices.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {voice.enabled && dictation.supported && (
                <button
                  type="button"
                  onClick={() => {
                    const next = !vivaMode;
                    setVivaMode(next);
                    if (!next) dictation.cancel();
                  }}
                  aria-pressed={vivaMode}
                  className={cn(
                    "-my-2 py-2 font-mono text-data transition-colors",
                    vivaMode ? "text-lamp" : "text-dim hover:text-ink",
                  )}
                >
                  {vivaMode ? "hands free on" : "hands free"}
                </button>
              )}

              {voice.speaking && (
                <button
                  type="button"
                  onClick={voice.stop}
                  className="-my-2 py-2 font-mono text-data text-dim underline decoration-rule underline-offset-4 hover:text-ink"
                >
                  skip
                </button>
              )}
            </>
          )}
          {voice.blocked && (
            <button
              type="button"
              onClick={voice.replay}
              className="-my-2 py-2 font-mono text-data text-lamp underline decoration-lamp-dim underline-offset-4"
            >
              tap to hear
            </button>
          )}
          <span className="font-mono text-data text-faint">
            session {sessionId.slice(0, 8)}
          </span>
        </div>
      </header>

      <div className="grid gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12">
        {/* The conversation: page prose, not a chat transcript */}
        <div>
          {exchanges.length === 0 && thinking && <PlanningState name={name} />}

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

            {thinking && exchanges.length > 0 && (
              <li aria-live="polite">
                <p className="flex items-center gap-2.5 font-mono text-data text-quill">
                  <ThinkingMark />
                  considering that answer
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
                onChange={(e) => {
                  setDraft(e.target.value);
                  // Typing means the candidate is still composing, so never
                  // let the hands-free countdown submit underneath them.
                  dictation.clearTimer();
                }}
                onPaste={() => {
                  pastedRef.current = true;
                }}
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
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  {dictation.supported && (
                    <button
                      type="button"
                      onClick={() =>
                        dictation.listening ? dictation.stop() : dictation.start()
                      }
                      aria-pressed={dictation.listening}
                      disabled={thinking}
                      className={cn(
                        "flex min-h-11 items-center gap-2 border px-3 font-mono text-data transition-colors disabled:opacity-40",
                        dictation.listening
                          ? "border-quill text-quill"
                          : "border-rule text-dim hover:border-quill hover:text-ink",
                      )}
                    >
                      <MicIcon listening={dictation.listening} />
                      {dictation.silencePending
                        ? "sending when you stop"
                        : dictation.listening
                          ? "listening, tap to stop"
                          : "answer aloud"}
                    </button>
                  )}
                  <span className="font-mono text-data text-faint">
                    Ctrl or Cmd plus Enter to send
                  </span>
                </div>
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
            <MindPanel
              view={view}
              marks={marks}
              thinking={thinking}
              onSteer={steer}
              steering={steering}
            />
          </div>
        </div>
      </div>

      {/* Mobile: a persistent summary bar that opens the full panel */}
      <MobileMind
        view={view}
        marks={marks}
        thinking={thinking}
        onSteer={steer}
        steering={steering}
      />
    </div>
  );
}

/* Icons are drawn inline rather than pulled from a set, so their stroke
   weight matches the hairline rules used everywhere else. */

/** A compact writing mark, so a mid-interview wait matches the opening one. */
function ThinkingMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect x="7" y="9" width="11" height="2.8" fill="currentColor" className="viva-stroke" />
      <rect
        x="7"
        y="14.5"
        width="15"
        height="2.8"
        fill="currentColor"
        className="viva-stroke"
        style={{ animationDelay: "0.18s" }}
      />
      <rect
        x="7"
        y="20"
        width="8"
        height="2.8"
        fill="currentColor"
        className="viva-stroke"
        style={{ animationDelay: "0.36s" }}
      />
    </svg>
  );
}

function SpeakerIcon({ on, speaking }: { on: boolean; speaking: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 6.2h2.2L8.4 3.4v9.2L5.2 9.8H3z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {on && (
        <>
          <path
            d="M10.8 6.1a2.7 2.7 0 0 1 0 3.8"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            className={speaking ? "animate-pulse" : undefined}
          />
          <path
            d="M12.6 4.3a5.2 5.2 0 0 1 0 7.4"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity={speaking ? 1 : 0.45}
            className={speaking ? "animate-pulse" : undefined}
          />
        </>
      )}
      {!on && (
        <path
          d="M11 6l3.4 4M14.4 6L11 10"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

function MicIcon({ listening }: { listening: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="6"
        y="2"
        width="4"
        height="7"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.2"
        fill={listening ? "currentColor" : "none"}
      />
      <path
        d="M3.8 7.6a4.2 4.2 0 0 0 8.4 0M8 11.8V14"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
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
  onSteer,
  steering,
}: {
  view: SessionView | null;
  marks: Parameters<typeof MindPanel>[0]["marks"];
  thinking: boolean;
  onSteer?: (kind: SteerKind, day?: number) => void;
  steering?: SteerKind | null;
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
          <MindPanel
            view={view}
            marks={marks}
            thinking={thinking}
            onSteer={onSteer}
            steering={steering}
            className="border-0"
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
