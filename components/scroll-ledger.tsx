"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { journeyOf, candidateById, type DayMark } from "@/lib/journey";

/**
 * The signature scroll moment: one candidate's 31 days marked a day at a time
 * as you scroll, in the examiner's own notation.
 *
 * It is a reading device, not an effect. The point being made is that Viva
 * reads a whole cohort record before it opens its mouth, so the page makes you
 * watch that record being read. The day counter, the title and the note all
 * track the scrubbed position.
 *
 * Under prefers-reduced-motion the section is not pinned at all: it renders as
 * a complete, static ledger with the summary text, which says the same thing
 * without moving anything.
 */

const COL = 30;
const STROKE_H = 5;
const STROKE_GAP = 9.5;
const BASELINE = 108;
const HEIGHT = 146;
const INSET = 4.5;
const MAX_STROKES = 5;

function markColor(mark: DayMark): string {
  if (mark.kind === "first-try") return "var(--quill)";
  if (mark.kind === "struggled") {
    return mark.attempts >= 3 ? "var(--lamp)" : "var(--quill)";
  }
  if (mark.kind === "failed") return "var(--lamp-dim)";
  return "var(--faint)";
}

export function ScrollLedger({ candidateId = "CAND-004" }: { candidateId?: string }) {
  const candidate = candidateById(candidateId);
  const marks = candidate ? journeyOf(candidate) : [];
  const sectionRef = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState(marks.length - 1);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    if (mq.matches) return;

    gsap.registerPlugin(ScrollTrigger);
    const section = sectionRef.current;
    const svg = svgRef.current;
    if (!section || !svg) return;

    // Start empty only once we know motion is wanted, so the no-JS and
    // reduced-motion paths keep the finished ledger.
    const groups = Array.from(svg.querySelectorAll<SVGGElement>("[data-day]"));
    setActive(0);

    const ctx = gsap.context(() => {
      gsap.set(groups, { opacity: 0 });

      ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "+=180%",
        pin: true,
        scrub: 0.4,
        onUpdate: (self) => {
          const upto = Math.round(self.progress * (groups.length - 1));
          groups.forEach((g, i) => {
            gsap.set(g, { opacity: i <= upto ? 1 : 0 });
          });
          setActive(upto);
        },
      });
    }, section);

    return () => ctx.revert();
  }, [marks.length]);

  if (!candidate) return null;

  const width = marks.length * COL;
  const current = marks[Math.min(active, marks.length - 1)];
  const passed = marks.filter((m) => m.kind === "first-try").length;
  const struggled = marks.filter((m) => m.kind === "struggled").length;
  const skipped = marks.filter((m) => m.kind === "skipped").length;

  return (
    <section
      ref={sectionRef}
      className="flex min-h-[100svh] flex-col justify-center border-t border-rule py-14"
    >
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 className="max-w-[18ch] font-voice text-[1.75rem] leading-tight text-ink sm:text-[2.125rem]">
              It reads all 31 days before it asks anything.
            </h2>
            <p className="mt-4 max-w-[46ch] text-body text-dim">
              {candidate.member?.name}&apos;s cohort record in the
              examiner&apos;s own notation: a stroke for every attempt, a hollow
              box for a day skipped, a brass rule under one never passed.
            </p>
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-2 font-mono text-data">
            <div>
              <dt className="text-faint">first try</dt>
              <dd className="mt-0.5 text-[1.3rem] text-quill">{passed}</dd>
            </div>
            <div>
              <dt className="text-faint">retried</dt>
              <dd className="mt-0.5 text-[1.3rem] text-lamp">{struggled}</dd>
            </div>
            <div>
              <dt className="text-faint">skipped</dt>
              <dd className="mt-0.5 text-[1.3rem] text-dim">{skipped}</dd>
            </div>
          </dl>
        </div>

        <div className="min-w-0">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${HEIGHT}`}
            className="h-[38svh] max-h-[290px] w-full"
            preserveAspectRatio="xMidYMax meet"
            role="img"
            aria-label={`${candidate.member?.name}'s 31 day cohort ledger: ${passed} days passed first try, ${struggled} needed repeat attempts, ${skipped} skipped.`}
          >
            <rect
              x={0}
              y={BASELINE + STROKE_H}
              width={width}
              height={1}
              fill="var(--rule)"
            />
            {marks.map((mark, i) => {
              const x = i * COL + INSET;
              const w = COL - INSET * 2;
              const strokes =
                mark.kind === "first-try" ||
                mark.kind === "struggled" ||
                mark.kind === "failed"
                  ? Math.min(mark.attempts, MAX_STROKES)
                  : 0;
              return (
                <g key={mark.day} data-day={mark.day}>
                  {mark.kind === "skipped" && (
                    <rect
                      x={x}
                      y={BASELINE - STROKE_H * 1.6}
                      width={w}
                      height={STROKE_H * 3}
                      fill="none"
                      stroke="var(--faint)"
                      strokeWidth={1.5}
                    />
                  )}
                  {mark.kind === "untouched" && (
                    <rect
                      x={x + w / 2 - 1.5}
                      y={BASELINE}
                      width={3}
                      height={3}
                      fill="var(--faint)"
                      opacity={0.6}
                    />
                  )}
                  {Array.from({ length: strokes }, (_, s) => (
                    <rect
                      key={s}
                      x={x}
                      y={BASELINE - s * STROKE_GAP}
                      width={w}
                      height={STROKE_H}
                      fill={markColor(mark)}
                    />
                  ))}
                  {mark.kind === "failed" && (
                    <rect
                      x={x}
                      y={BASELINE + STROKE_H + 7}
                      width={w}
                      height={STROKE_H}
                      fill="var(--lamp)"
                    />
                  )}
                  {(mark.day === 1 || mark.day % 5 === 0) && (
                    <text
                      x={i * COL + COL / 2}
                      y={HEIGHT - 8}
                      textAnchor="middle"
                      fill="var(--faint)"
                      style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}
                    >
                      {mark.day}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          <div className="mt-5 border-t border-rule-soft pt-4">
            {reduced ? (
              <p className="text-ui text-dim">
                Viva plans the interview from this record, opening on whichever
                day the marks say went worst.
              </p>
            ) : (
              <>
                <p className="font-mono text-data text-quill">
                  Day {current?.day}
                  <span className="text-faint"> · {current?.title}</span>
                </p>
                <p className="mt-1 min-h-[1.5em] text-ui text-dim">
                  {current?.note}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
