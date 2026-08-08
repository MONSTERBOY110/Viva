"use client";

import { useEffect, useId, useRef } from "react";
import gsap from "gsap";
import type { DayMark } from "@/lib/journey";
import { cn } from "@/lib/utils";

/**
 * The Ledger: 31 curriculum days written in the examiner's own notation.
 * A stroke per attempt stacked upward, a hollow box for a skipped day, a brass
 * underscore for one never passed. Not a chart of the journey, the journey.
 *
 * Every mark differs in SHAPE as well as colour (stroke count, hollow, rule,
 * dot), so meaning survives colour blindness and print.
 */

type Geometry = {
  col: number;
  strokeH: number;
  strokeGap: number;
  baseline: number;
  height: number;
  inset: number;
  underscore: number;
};

const COMPACT: Geometry = {
  col: 5.6,
  strokeH: 1.8,
  strokeGap: 3,
  baseline: 16,
  height: 22,
  inset: 0.7,
  underscore: 2.8,
};

const FULL: Geometry = {
  col: 22,
  strokeH: 3,
  strokeGap: 5.5,
  baseline: 62,
  height: 92,
  inset: 3,
  underscore: 6,
};

const MAX_STROKES = 5;

function markColor(mark: DayMark): string {
  switch (mark.kind) {
    case "first-try":
      return "var(--quill)";
    case "struggled":
      return mark.attempts >= 3 ? "var(--lamp)" : "var(--quill)";
    case "failed":
      return "var(--lamp-dim)";
    default:
      return "var(--faint)";
  }
}

export function Ledger({
  marks,
  variant = "compact",
  activeDays = [],
  onHoverDay,
  className,
  animate = false,
  label,
}: {
  marks: DayMark[];
  variant?: "compact" | "full";
  /** Days already covered in the live interview, drawn as a lit column. */
  activeDays?: number[];
  onHoverDay?: (mark: DayMark | null) => void;
  className?: string;
  animate?: boolean;
  label?: string;
}) {
  const g = variant === "full" ? FULL : COMPACT;
  const width = marks.length * g.col;
  const rootRef = useRef<SVGSVGElement | null>(null);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  useEffect(() => {
    if (!animate || !rootRef.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const strokes = rootRef.current.querySelectorAll("[data-stroke]");
    if (reduce || strokes.length === 0) return;

    // A page whose thesis is "we already read this" earns one moment of writing.
    const ctx = gsap.context(() => {
      gsap.from(strokes, {
        scaleX: 0,
        transformOrigin: "left center",
        duration: 0.34,
        ease: "power3.out",
        stagger: { each: 0.006, from: "start" },
      });
    }, rootRef);
    return () => ctx.revert();
  }, [animate]);

  const summary = describeLedger(marks);

  return (
    <svg
      ref={rootRef}
      viewBox={`0 0 ${width} ${g.height}`}
      width="100%"
      height={variant === "full" ? undefined : g.height}
      className={cn(
        variant === "full" ? "block w-full" : "block",
        variant === "compact" && "max-w-[190px]",
        className,
      )}
      role="img"
      aria-label={label ? `${label}. ${summary}` : summary}
      onMouseLeave={() => onHoverDay?.(null)}
      style={variant === "compact" ? { width, height: g.height } : undefined}
    >
      {/* The ruled line every mark sits on. */}
      <rect
        x={0}
        y={g.baseline + g.strokeH}
        width={width}
        height={variant === "full" ? 1 : 0.75}
        fill="var(--rule)"
      />

      {marks.map((mark, i) => {
        const x = i * g.col + g.inset;
        const w = g.col - g.inset * 2;
        const lit = activeDays.includes(mark.day);
        const color = lit ? "var(--quill-bright)" : markColor(mark);

        return (
          <g
            key={mark.day}
            onMouseEnter={onHoverDay ? () => onHoverDay(mark) : undefined}
            style={onHoverDay ? { cursor: "crosshair" } : undefined}
          >
            {/* Generous invisible hit area so hovering a narrow column is easy. */}
            {onHoverDay && (
              <rect
                x={i * g.col}
                y={0}
                width={g.col}
                height={g.height}
                fill="transparent"
              />
            )}

            {lit && (
              <rect
                x={i * g.col}
                y={0}
                width={g.col}
                height={g.baseline + g.strokeH}
                fill="var(--quill)"
                opacity={0.1}
              />
            )}

            {mark.kind === "skipped" && (
              <rect
                x={x}
                y={g.baseline - g.strokeH * 1.5}
                width={w}
                height={g.strokeH * 2.5}
                fill="none"
                stroke="var(--faint)"
                strokeWidth={variant === "full" ? 1.25 : 0.75}
                shapeRendering="crispEdges"
              />
            )}

            {mark.kind === "untouched" && (
              <rect
                x={x + w / 2 - g.strokeH / 2}
                y={g.baseline}
                width={g.strokeH}
                height={g.strokeH}
                fill="var(--faint)"
                opacity={0.55}
              />
            )}

            {/* One stroke per attempt, stacked upward like a tally. */}
            {(mark.kind === "first-try" ||
              mark.kind === "struggled" ||
              mark.kind === "failed") &&
              Array.from(
                { length: Math.min(mark.attempts, MAX_STROKES) },
                (_, s) => (
                  <rect
                    key={s}
                    data-stroke={`${uid}-${mark.day}-${s}`}
                    x={x}
                    y={g.baseline - s * g.strokeGap}
                    width={w}
                    height={g.strokeH}
                    fill={color}
                    shapeRendering="crispEdges"
                  />
                ),
              )}

            {/* Never passed: the examiner's underscore. */}
            {mark.kind === "failed" && (
              <rect
                x={x}
                y={g.baseline + g.strokeH + g.underscore}
                width={w}
                height={g.strokeH}
                fill="var(--lamp)"
                shapeRendering="crispEdges"
              />
            )}

            {variant === "full" && (mark.day === 1 || mark.day % 5 === 0) && (
              <text
                x={i * g.col + g.col / 2}
                y={g.height - 6}
                textAnchor="middle"
                fill="var(--faint)"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9.5,
                  letterSpacing: "0.04em",
                }}
              >
                {mark.day}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Screen reader sentence for the whole strip. */
function describeLedger(marks: DayMark[]): string {
  const firstTry = marks.filter((m) => m.kind === "first-try").length;
  const struggled = marks.filter((m) => m.kind === "struggled");
  const skipped = marks.filter((m) => m.kind === "skipped");
  const failed = marks.filter((m) => m.kind === "failed");
  const parts = [`31 day cohort ledger: ${firstTry} days passed first try`];
  if (struggled.length) {
    const worst = [...struggled].sort((a, b) => b.attempts - a.attempts)[0];
    parts.push(
      `${struggled.length} needed repeat attempts, hardest was day ${worst.day} at ${worst.attempts} attempts`,
    );
  }
  if (skipped.length) {
    parts.push(
      `${skipped.length} skipped: days ${skipped.map((m) => m.day).join(", ")}`,
    );
  }
  if (failed.length) {
    parts.push(
      `${failed.length} never passed: days ${failed.map((m) => m.day).join(", ")}`,
    );
  }
  return `${parts.join(". ")}.`;
}
