"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { Ledger } from "@/components/ledger";
import { Bar } from "@/components/skeleton-bits";
import type { DayMark } from "@/lib/journey";
import type { SteerKind } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The Interviewer Mind: a first class surface, not a debug drawer.
 * Reads GET /api/session/[id] so the judge-facing contract response at
 * POST /api/interview stays exactly the shape technical-spec.md defines.
 */

export type SessionView = {
  found: boolean;
  phase?: "active" | "wrapping" | "done";
  plan?: {
    candidateId: string;
    personaNotes: string;
    topics: {
      day: number;
      module: string;
      reason: "struggled" | "skipped" | "verify-strength" | "core";
      reasonDetail: string;
      startDifficulty: 1 | 2 | 3;
    }[];
  } | null;
  priorMemories?: string[];
  current?: {
    day: number;
    module: string;
    difficulty: number;
    rationale: string;
    question: string;
  } | null;
  reasoning?: {
    day: number;
    module: string;
    difficulty: number;
    rationale: string;
    evaluation: {
      score: number;
      classification: string;
      evidence: string;
    } | null;
  }[];
  coverage?: { days: number[]; distinct: number; required: number; planned: number[] };
  confidence?: Record<string, number>;
  counts?: { asked: number; answered: number };
};

const REASON_LABEL: Record<string, string> = {
  struggled: "struggled",
  skipped: "skipped",
  "verify-strength": "verify strength",
  core: "core topic",
};

const DIFFICULTY_LABEL: Record<number, string> = {
  1: "L1 recall",
  2: "L2 application",
  3: "L3 depth",
};

export function MindPanel({
  view,
  marks,
  thinking,
  className,
  onSteer,
  steering,
}: {
  view: SessionView | null;
  marks: DayMark[];
  thinking: boolean;
  className?: string;
  /** When provided, the panel stops being read only and takes the wheel. */
  onSteer?: (kind: SteerKind, day?: number) => void;
  steering?: SteerKind | null;
}) {
  const rationaleRef = useRef<HTMLParagraphElement>(null);
  const lastRationale = useRef<string>("");

  const current = view?.current ?? null;
  const coverage = view?.coverage;
  const confidence = view?.confidence ?? {};
  const topics = view?.plan?.topics ?? [];
  const covered = new Set(coverage?.days ?? []);
  const history = (view?.reasoning ?? []).filter((r) => r.evaluation).reverse();

  // New reasoning arrives as a short crossfade with a small rise, animated from
  // its current on screen value so a fast answer never causes a jump.
  useEffect(() => {
    const el = rationaleRef.current;
    const text = current?.rationale ?? "";
    if (!el || !text || text === lastRationale.current) return;
    lastRationale.current = text;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(
      el,
      { opacity: 0, y: 6 },
      { opacity: 1, y: 0, duration: 0.24, ease: "power3.out", overwrite: "auto" },
    );
  }, [current?.rationale]);

  if (!view?.found) {
    return (
      <aside
        className={cn("border border-rule bg-panel", className)}
        aria-label="Interviewer reasoning, loading"
        aria-busy="true"
      >
        <PanelHeader thinking={thinking} />
        <div className="space-y-2.5 border-b border-rule-soft p-4">
          <Bar w="5rem" h="0.6rem" />
          <Bar w="9rem" h="0.8rem" />
          <Bar w="100%" h="0.8rem" />
          <Bar w="78%" h="0.8rem" />
        </div>
        <div className="space-y-2.5 border-b border-rule-soft p-4">
          <Bar w="4.5rem" h="0.6rem" />
          <Bar w="100%" h="1.2rem" />
        </div>
        <div className="space-y-3 p-4">
          <Bar w="3rem" h="0.6rem" />
          {[0, 1, 2].map((i) => (
            <span key={i} className="block space-y-1.5">
              <Bar w="6rem" h="0.7rem" />
              <Bar w={`${86 - i * 10}%`} h="0.7rem" />
            </span>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={cn("border border-rule bg-panel", className)}
      aria-label="Interviewer reasoning"
    >
      <PanelHeader thinking={thinking} />

      {/* Live Steer: the panel is a control surface, not just a readout. */}
      {onSteer && view.phase !== "done" && (
        <section className="border-b border-rule-soft p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="field-label">Take the wheel</h3>
            {steering && (
              <span className="font-mono text-data text-lamp">
                applies next question
              </span>
            )}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <SteerButton
              label="press harder"
              kind="harder"
              active={steering === "harder"}
              onSteer={onSteer}
            />
            <SteerButton
              label="ease off"
              kind="easier"
              active={steering === "easier"}
              onSteer={onSteer}
            />
            <SteerButton
              label="move on"
              kind="move-on"
              active={steering === "move-on"}
              onSteer={onSteer}
            />
            <SteerButton
              label="wrap up"
              kind="wrap"
              active={steering === "wrap"}
              onSteer={onSteer}
            />
          </div>
          {topics.length > 0 && (
            <div className="mt-2.5">
              <label className="sr-only" htmlFor="steer-day">
                Send the examiner to a specific curriculum day
              </label>
              <select
                id="steer-day"
                value=""
                onChange={(e) => {
                  const day = Number(e.target.value);
                  if (day) onSteer("day", day);
                }}
                className="w-full border border-rule bg-ground px-2 py-1.5 font-mono text-data text-dim outline-none transition-colors hover:text-ink focus-visible:border-quill"
              >
                <option value="">jump to a planned day...</option>
                {topics.map((t) => (
                  <option key={t.day} value={t.day}>
                    Day {t.day} · {t.module}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="mt-2 text-ui-sm text-faint">
            Guardrails still win. A steer cannot take the interview below its
            required questions or curriculum coverage.
          </p>
        </section>
      )}

      {/* Now probing */}
      <section className="border-b border-rule-soft p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="field-label">Now probing</h3>
          {current && (
            <span className="font-mono text-data text-dim">
              {DIFFICULTY_LABEL[current.difficulty] ?? `L${current.difficulty}`}
            </span>
          )}
        </div>
        {current ? (
          <>
            <p className="mt-2 font-mono text-ui-sm text-quill">
              Day {current.day}
              <span className="text-dim"> · {current.module}</span>
            </p>
            <p
              ref={rationaleRef}
              className="mt-2 font-voice text-[1rem] italic leading-relaxed text-ink"
            >
              {current.rationale}
            </p>
          </>
        ) : (
          <p className="mt-2 text-ui text-dim">
            Reading the candidate&apos;s 31 days.
          </p>
        )}
      </section>

      {/* Coverage, drawn in the same notation as the roster ledger */}
      <section className="border-b border-rule-soft p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="field-label">Coverage</h3>
          <span className="font-mono text-data text-dim">
            <span className={cn(
              (coverage?.distinct ?? 0) >= (coverage?.required ?? 4)
                ? "text-quill"
                : "text-lamp",
            )}>
              {coverage?.distinct ?? 0}
            </span>
            {" / "}
            {coverage?.required ?? 4} days minimum
          </span>
        </div>
        <div className="mt-2.5">
          <Ledger
            marks={marks}
            variant="compact"
            activeDays={coverage?.days ?? []}
            className="!max-w-none !w-full"
            label="Curriculum days covered so far"
          />
        </div>
        <p className="mt-2 font-mono text-data text-faint">
          question {view.counts?.asked ?? 0} of 8 to 12
        </p>
      </section>

      {/* Per module confidence */}
      {Object.keys(confidence).length > 0 && (
        <section className="border-b border-rule-soft p-4">
          <h3 className="field-label">Confidence</h3>
          <ul className="mt-2.5 space-y-2">
            {Object.entries(confidence).map(([module, score]) => (
              <li key={module} className="grid grid-cols-[1fr_auto] items-center gap-3">
                <span className="truncate text-ui-sm text-dim" title={module}>
                  {module}
                </span>
                <span className="flex items-center gap-2">
                  <Meter value={score} />
                  <span className="w-8 text-right font-mono text-data text-ink">
                    {score.toFixed(2)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* The plan */}
      {topics.length > 0 && (
        <section className="border-b border-rule-soft p-4">
          <h3 className="field-label">Plan</h3>
          <ol className="mt-2.5 space-y-2">
            {topics.map((topic) => {
              const done = covered.has(topic.day);
              const isCurrent = current?.day === topic.day;
              return (
                <li key={topic.day} className="grid grid-cols-[1rem_1fr] gap-2">
                  <span
                    aria-hidden
                    className={cn(
                      "font-mono text-data leading-5",
                      isCurrent ? "text-lamp" : done ? "text-quill" : "text-faint",
                    )}
                  >
                    {isCurrent ? "›" : done ? "✓" : "·"}
                  </span>
                  <span className="min-w-0">
                    <span className="font-mono text-data text-dim">
                      Day {topic.day}
                    </span>
                    <span className="sr-only">
                      {done ? " covered" : isCurrent ? " in progress" : " planned"}
                    </span>
                    <span
                      className={cn(
                        "ml-2 text-ui-sm",
                        topic.reason === "core" ? "text-faint" : "text-lamp",
                      )}
                    >
                      {REASON_LABEL[topic.reason] ?? topic.reason}
                    </span>
                    <span className="block truncate text-ui-sm text-faint">
                      {topic.reasonDetail}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Continuity from a previous interview, when Breeth has memory */}
      {(view.priorMemories?.length ?? 0) > 0 && (
        <section className="border-b border-rule-soft p-4">
          <h3 className="field-label">Remembered from last time</h3>
          <ul className="mt-2 space-y-1.5">
            {view.priorMemories!.slice(0, 4).map((m, i) => (
              <li key={i} className="text-ui-sm text-dim">
                {m}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Reasoning history */}
      {history.length > 0 && (
        <section className="p-4">
          <h3 className="field-label">Earlier judgements</h3>
          <ul className="mt-2.5 space-y-3">
            {history.slice(0, 6).map((r, i) => (
              <li key={i} className="border-t border-rule-soft pt-2.5 first:border-0 first:pt-0">
                <p className="font-mono text-data text-dim">
                  Day {r.day}
                  <span className="text-faint"> · </span>
                  <ClassificationTag value={r.evaluation!.classification} />
                  <span className="text-faint"> · {r.evaluation!.score.toFixed(2)}</span>
                </p>
                <p className="mt-1 text-ui-sm text-faint">
                  &ldquo;{r.evaluation!.evidence}&rdquo;
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}

function SteerButton({
  label,
  kind,
  active,
  onSteer,
}: {
  label: string;
  kind: SteerKind;
  active: boolean;
  onSteer: (kind: SteerKind, day?: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSteer(kind)}
      aria-pressed={active}
      className={cn(
        "border px-2.5 py-1.5 font-mono text-data transition-colors",
        active
          ? "border-lamp text-lamp"
          : "border-rule text-dim hover:border-quill hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}

function PanelHeader({ thinking }: { thinking: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-rule px-4 py-3">
      <h2 className="font-voice text-[1.0625rem] text-ink">Interviewer mind</h2>
      <span
        className="flex items-center gap-2 font-mono text-data text-dim"
        aria-live="polite"
      >
        <span
          aria-hidden
          className={cn(
            "inline-block h-1.5 w-1.5 rounded-full",
            thinking ? "animate-pulse bg-lamp" : "bg-quill",
          )}
        />
        {thinking ? "thinking" : "listening"}
      </span>
    </div>
  );
}

function Meter({ value }: { value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <span
      className="block h-1.5 w-16 bg-rule"
      role="img"
      aria-label={`confidence ${pct} percent`}
    >
      <span
        className="block h-full bg-quill transition-[width] duration-200 ease-out"
        style={{ width: `${pct}%` }}
      />
    </span>
  );
}

function ClassificationTag({ value }: { value: string }) {
  const tone =
    value === "strong"
      ? "text-quill"
      : value === "partial"
        ? "text-dim"
        : "text-lamp";
  return <span className={tone}>{value}</span>;
}

