"use client";

import { useEffect, useMemo, useState } from "react";
import { Ledger } from "@/components/ledger";
import { moduleTitleFor, dayTitleFor, type DayMark } from "@/lib/journey";
import { updateConfidence } from "@/lib/engine/policy";
import type { Turn } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Replay the reasoning.
 *
 * The live Mind panel is the best thing about watching an interview, and it is
 * gone by the time anyone reads the report. Every input it needs was already
 * stored per turn, so the panel state can be rebuilt exactly as it stood at
 * any question and scrubbed through afterwards. Nothing here is recomputed by
 * a model; coverage and confidence are replayed from the recorded evaluations
 * using the same rule the live engine used.
 */

const DIFFICULTY_LABEL: Record<number, string> = {
  1: "L1 recall",
  2: "L2 application",
  3: "L3 depth",
};

type Frame = {
  index: number;
  turn: Turn;
  coverage: number[];
  confidence: Record<string, number>;
};

function buildFrames(turns: Turn[]): Frame[] {
  const frames: Frame[] = [];
  let confidence: Record<string, number> = {};
  const coverage: number[] = [];

  turns.forEach((turn, index) => {
    if (!coverage.includes(turn.day)) coverage.push(turn.day);
    // The evaluation belongs to the answer given to THIS question, so it is
    // folded in as the frame is built, matching the live engine's ordering.
    if (turn.eval) {
      confidence = updateConfidence(
        confidence,
        moduleTitleFor(turn.day),
        turn.eval.score,
      );
    }
    frames.push({
      index,
      turn,
      coverage: [...coverage],
      confidence: { ...confidence },
    });
  });

  return frames;
}

export function ReasoningReplay({
  turns,
  marks,
}: {
  turns: Turn[];
  marks: DayMark[];
}) {
  const frames = useMemo(() => buildFrames(turns), [turns]);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    if (i >= frames.length - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setI((n) => Math.min(n + 1, frames.length - 1)), 2400);
    return () => clearTimeout(t);
  }, [playing, i, frames.length]);

  if (frames.length === 0) return null;
  const frame = frames[i];
  const { turn } = frame;

  // The rationale carries its own provenance markers from the engine.
  const steered = turn.rationale.match(/\[steered by observer: ([^\]]+)\]/)?.[1];
  const policy = turn.rationale.match(/\[policy: ([^\]]+)\]/)?.[1];
  const thought = turn.rationale
    .replace(/\[steered by observer: [^\]]+\]/, "")
    .replace(/\[policy: [^\]]+\]/, "")
    .trim();

  return (
    <section className="border-t border-rule py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="field-label">Replay the reasoning</h2>
        <p className="font-mono text-data text-faint">
          question {i + 1} of {frames.length}
        </p>
      </div>
      <p className="mt-2 max-w-[62ch] text-ui-sm text-dim">
        The panel the candidate saw while answering, rebuilt from what was
        recorded. Scrub to watch coverage fill and confidence move.
      </p>

      {/* Transport */}
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (i >= frames.length - 1) setI(0);
            setPlaying((p) => !p);
          }}
          className="min-h-11 border border-rule px-4 font-mono text-data text-ink transition-colors hover:border-quill"
          aria-label={playing ? "Pause replay" : "Play replay"}
        >
          {playing ? "pause" : i >= frames.length - 1 ? "replay" : "play"}
        </button>
        <input
          type="range"
          min={0}
          max={frames.length - 1}
          value={i}
          onChange={(e) => {
            setPlaying(false);
            setI(Number(e.target.value));
          }}
          aria-label="Scrub through the interview"
          className="h-1 flex-1 cursor-pointer appearance-none rounded-none bg-rule accent-[var(--quill)]"
        />
      </div>

      {/* Step markers, each one a question */}
      <ol className="mt-3 flex flex-wrap gap-1">
        {frames.map((f) => (
          <li key={f.index}>
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setI(f.index);
              }}
              aria-label={`Question ${f.index + 1}, Day ${f.turn.day}`}
              aria-current={f.index === i}
              className={cn(
                "h-7 w-7 border font-mono text-[0.7rem] transition-colors",
                f.index === i
                  ? "border-quill text-quill"
                  : f.index < i
                    ? "border-rule text-dim"
                    : "border-rule-soft text-faint",
                f.turn.steeredBy && "border-lamp",
              )}
            >
              {f.index + 1}
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        {/* What was asked, and why */}
        <div className="border border-rule bg-panel p-4">
          <p className="font-mono text-data text-dim">
            <span className="text-quill">Day {turn.day}</span>
            <span className="text-faint">
              {" "}
              · {dayTitleFor(turn.day)} ·{" "}
              {DIFFICULTY_LABEL[turn.difficulty] ?? `L${turn.difficulty}`}
            </span>
          </p>
          <p className="mt-2 max-w-[58ch] font-voice text-[1.0625rem] leading-relaxed text-ink">
            {turn.q}
          </p>

          <div className="mt-4 border-t border-rule-soft pt-3">
            <p className="field-label">Why this question</p>
            <p className="mt-1.5 max-w-[58ch] font-voice text-[1rem] italic leading-relaxed text-ink">
              {thought}
            </p>
            {steered && (
              <p className="mt-2 font-mono text-data text-lamp">
                steered by observer: {steered}
              </p>
            )}
            {policy && (
              <p className="mt-1 font-mono text-data text-lamp">policy: {policy}</p>
            )}
          </div>

          {turn.eval && (
            <div className="mt-4 border-t border-rule-soft pt-3">
              <p className="field-label">How the answer scored</p>
              <p className="mt-1.5 font-mono text-data text-dim">
                <span
                  className={
                    turn.eval.classification === "strong"
                      ? "text-quill"
                      : turn.eval.classification === "partial"
                        ? "text-dim"
                        : "text-lamp"
                  }
                >
                  {turn.eval.classification}
                </span>
                <span className="text-faint"> · {turn.eval.score.toFixed(2)}</span>
              </p>
              <p className="mt-1 max-w-[58ch] text-ui-sm text-faint">
                &ldquo;{turn.eval.evidence}&rdquo;
              </p>
            </div>
          )}
        </div>

        {/* The panel state at this exact moment */}
        <div className="border border-rule bg-panel p-4">
          <p className="field-label">Coverage at this point</p>
          <div className="mt-2.5">
            <Ledger
              marks={marks}
              variant="compact"
              activeDays={frame.coverage}
              className="!w-full !max-w-none"
              label={`Curriculum days covered by question ${i + 1}`}
            />
          </div>
          <p className="mt-2 font-mono text-data text-faint">
            {frame.coverage.length} distinct days
          </p>

          {Object.keys(frame.confidence).length > 0 && (
            <div className="mt-4 border-t border-rule-soft pt-3">
              <p className="field-label">Confidence so far</p>
              <ul className="mt-2.5 space-y-2">
                {Object.entries(frame.confidence).map(([module, score]) => (
                  <li
                    key={module}
                    className="grid grid-cols-[1fr_auto] items-center gap-3"
                  >
                    <span className="truncate text-ui-sm text-dim" title={module}>
                      {module}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="block h-1.5 w-14 bg-rule">
                        <span
                          className="block h-full bg-quill transition-[width] duration-300 ease-out"
                          style={{ width: `${Math.round(score * 100)}%` }}
                        />
                      </span>
                      <span className="w-8 text-right font-mono text-data text-ink">
                        {score.toFixed(2)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
