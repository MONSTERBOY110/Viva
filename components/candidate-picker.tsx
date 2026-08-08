"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { journeyOf, signalsOf, type DayMark } from "@/lib/journey";
import type { Candidate } from "@/lib/types";
import { Ledger } from "@/components/ledger";
import { CustomCandidateDialog } from "@/components/custom-candidate-dialog";
import { cn } from "@/lib/utils";

const Spine = dynamic(() => import("@/components/spine").then((m) => m.Spine), {
  ssr: false,
  loading: () => <SpineFallback />,
});

export function CandidatePicker({ candidates }: { candidates: Candidate[] }) {
  const router = useRouter();
  const [focused, setFocused] = useState<string>(
    candidates[0]?.member?.id ?? "",
  );
  const [hoveredMark, setHoveredMark] = useState<DayMark | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  const journeys = useMemo(
    () => new Map(candidates.map((c) => [c.member!.id!, journeyOf(c)])),
    [candidates],
  );

  const focusedCandidate =
    candidates.find((c) => c.member?.id === focused) ?? candidates[0];
  const focusedJourney = journeys.get(focused) ?? [];

  const begin = useCallback(
    (candidate: Candidate) => {
      const id = candidate.member?.id;
      if (!id) return;
      setStarting(id);
      router.push(
        `/interview/${crypto.randomUUID()}?c=${encodeURIComponent(id)}`,
      );
    },
    [router],
  );

  const beginCustom = useCallback(
    (candidate: Candidate) => {
      const sessionId = crypto.randomUUID();
      try {
        sessionStorage.setItem(
          `viva:candidate:${sessionId}`,
          JSON.stringify(candidate),
        );
      } catch {
        // Private mode browsers: the interview page falls back to a plain start.
      }
      router.push(`/interview/${sessionId}?custom=1`);
    },
    [router],
  );

  return (
    <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[1fr_minmax(340px,420px)]">
      {/* The roster */}
      <div className="order-2 lg:order-1">
        <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-rule pb-3">
          <h2 className="field-label">
            Cohort roster · {candidates.length} graduates
          </h2>
          <CustomCandidateDialog onStart={beginCustom} />
        </div>

        <ul className="divide-y divide-rule-soft">
          {candidates.map((candidate) => {
            const id = candidate.member!.id!;
            const marks = journeys.get(id) ?? [];
            const isFocused = id === focused;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => begin(candidate)}
                  onMouseEnter={() => setFocused(id)}
                  onFocus={() => setFocused(id)}
                  disabled={starting !== null}
                  aria-describedby={`sig-${id}`}
                  className={cn(
                    "group grid w-full grid-cols-[1fr_auto] items-center gap-x-6 px-2 py-4 text-left transition-colors duration-150 sm:px-3",
                    "hover:bg-panel focus-visible:bg-panel disabled:opacity-50",
                    isFocused && "bg-panel",
                  )}
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-voice text-[1.0625rem] text-ink">
                        {candidate.member?.name}
                      </span>
                      <span className="text-ui-sm text-dim">
                        {candidate.member?.jobRole}
                        {typeof candidate.member?.yearsExperience === "number" &&
                          ` · ${candidate.member.yearsExperience}y`}
                      </span>
                    </span>
                    <span
                      id={`sig-${id}`}
                      className="mt-1.5 flex items-center truncate font-mono text-data text-faint"
                    >
                      {signalsOf(candidate)
                        .slice(0, 3)
                        .map((s, i) => (
                          <span key={s} className="shrink-0 whitespace-nowrap">
                            {i > 0 && <span className="mx-2 text-rule">·</span>}
                            {s}
                          </span>
                        ))}
                    </span>
                  </span>

                  <span className="flex items-center gap-4">
                    <Ledger
                      marks={marks}
                      variant="compact"
                      label={`${candidate.member?.name}'s cohort ledger`}
                      className="hidden sm:block"
                    />
                    <span
                      aria-hidden
                      className={cn(
                        "font-mono text-ui text-faint transition-all duration-150",
                        "group-hover:translate-x-0.5 group-hover:text-quill group-focus-visible:text-quill",
                      )}
                    >
                      {starting === id ? "..." : "→"}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* The Spine */}
      <div className="order-1 lg:order-2">
        <div className="lg:sticky lg:top-8">
          <div className="relative overflow-hidden border border-rule bg-panel">
            <div className="h-[280px] sm:h-[340px]">
              <Spine marks={focusedJourney} onHoverDay={setHoveredMark} />
            </div>

            <div className="border-t border-rule-soft px-4 py-3">
              <p className="field-label">
                {hoveredMark
                  ? `Day ${hoveredMark.day}`
                  : focusedCandidate?.member?.name}
              </p>
              <p className="mt-1 min-h-[2.6em] text-ui text-ink">
                {hoveredMark ? (
                  <>
                    {hoveredMark.title}
                    <span className="text-dim">, {hoveredMark.note}</span>
                  </>
                ) : (
                  <span className="text-dim">
                    {focusedCandidate?.member?.jobRole}. Every stroke is one
                    attempt at one day of the cohort. Hover a column to read it.
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 px-1 font-mono text-data text-faint">
            <LegendMark kind="first-try" label="passed first try" />
            <LegendMark kind="struggled" label="repeat attempts" />
            <LegendMark kind="skipped" label="skipped" />
            <LegendMark kind="failed" label="never passed" />
          </div>
        </div>
      </div>
    </div>
  );
}

function LegendMark({ kind, label }: { kind: DayMark["kind"]; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <svg width="12" height="14" aria-hidden className="shrink-0">
        {kind === "first-try" && (
          <rect x="1" y="10" width="10" height="2" fill="var(--quill)" />
        )}
        {kind === "struggled" && (
          <>
            <rect x="1" y="10" width="10" height="2" fill="var(--lamp)" />
            <rect x="1" y="6.5" width="10" height="2" fill="var(--lamp)" />
            <rect x="1" y="3" width="10" height="2" fill="var(--lamp)" />
          </>
        )}
        {kind === "skipped" && (
          <rect
            x="1"
            y="8"
            width="10"
            height="5"
            fill="none"
            stroke="var(--faint)"
            strokeWidth="1"
          />
        )}
        {kind === "failed" && (
          <>
            <rect x="1" y="8" width="10" height="2" fill="var(--lamp-dim)" />
            <rect x="1" y="12.5" width="10" height="2" fill="var(--lamp)" />
          </>
        )}
      </svg>
      {label}
    </span>
  );
}

function SpineFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="font-mono text-data text-faint">drawing the cohort...</p>
    </div>
  );
}
