"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The wait before the first question is real: the planner reads the
 * candidate's 31 days and makes a model call. Several seconds of a quiet page
 * reads as broken, and a judge who thinks it is broken leaves, so the wait is
 * shown as work in progress with the steps named as they happen.
 *
 * The indicator is the product's own tally mark drawing itself rather than a
 * generic spinner.
 */

const STAGES = [
  "Reading the 31 day journey",
  "Finding where it went wrong",
  "Planning the topics to probe",
  "Writing the opening question",
];

export function WritingMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("h-10 w-10 text-quill", className)}
      aria-hidden
      focusable="false"
    >
      <rect
        x="7"
        y="8"
        width="11"
        height="2.6"
        fill="currentColor"
        className="viva-stroke"
      />
      <rect
        x="7"
        y="13"
        width="15"
        height="2.6"
        fill="currentColor"
        className="viva-stroke"
        style={{ animationDelay: "0.18s" }}
      />
      <rect
        x="7"
        y="18"
        width="8"
        height="2.6"
        fill="currentColor"
        className="viva-stroke"
        style={{ animationDelay: "0.36s" }}
      />
      <rect x="6" y="24" width="20" height="1.6" className="fill-rule" />
    </svg>
  );
}

/** Cycles the stage text so a long wait still shows movement. */
function useStage(active: boolean) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setI((n) => Math.min(n + 1, STAGES.length - 1)), 2200);
    return () => clearInterval(t);
  }, [active]);
  return STAGES[i];
}

export function PlanningState({
  name,
  className,
}: {
  name?: string | null;
  className?: string;
}) {
  const stage = useStage(true);
  return (
    <div
      className={cn(
        "flex min-h-[50vh] flex-col items-center justify-center px-6 text-center",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <WritingMark />
      <p className="mt-6 font-voice text-[1.25rem] text-ink">
        {name ? `Reading ${name}'s cohort record` : "Preparing your interview"}
      </p>
      <p className="mt-2 min-h-[1.5em] font-mono text-data text-dim">{stage}</p>
      <p className="mt-5 max-w-[42ch] text-ui-sm text-faint">
        Viva plans the whole interview before it asks anything, so the first
        question is already about this person. It takes a few seconds.
      </p>
    </div>
  );
}

/**
 * Shown on the roster the instant a candidate is chosen, so the click has a
 * visible consequence before the next route has even started rendering.
 */
export function LaunchOverlay({ name }: { name?: string | null }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ground/92 backdrop-blur-sm"
      role="status"
      aria-live="assertive"
    >
      <PlanningState name={name} className="min-h-0" />
    </div>
  );
}
