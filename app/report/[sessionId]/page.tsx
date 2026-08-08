import Link from "next/link";
import { getSessionStore } from "@/lib/store/session";
import { journeyOf, dayTitleFor, moduleTitleFor } from "@/lib/journey";
import { Ledger } from "@/components/ledger";
import { PrintButton } from "@/components/print-button";
import { LogoMark } from "@/components/logo";
import type { EvidenceItem } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * The evidence linked report. Every strength and gap can be opened to reveal
 * the candidate's own sentence and the curriculum day behind it, because a
 * claim without evidence is the thing this product exists to replace.
 */
export default async function ReportPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await getSessionStore().get(sessionId).catch(() => null);

  if (!session?.report) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-[720px] px-5 py-16 sm:px-8">
        <h1 className="font-voice text-[1.75rem] text-ink">
          No report on file for this session
        </h1>
        <p className="mt-3 max-w-[60ch] text-body text-dim">
          A report is written when an interview reaches its final question. If
          the interview is still running, finish it and the report will appear
          here. Sessions are kept for 48 hours.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block bg-quill-bright px-5 py-2 text-ui font-medium text-ground transition-opacity hover:opacity-90"
        >
          Choose a candidate
        </Link>
      </main>
    );
  }

  const { feedback, evidenceMap = [] } = session.report;
  const marks = journeyOf(session.candidate);
  const turns = session.turns ?? [];
  const covered = [...new Set(turns.map((t) => t.day))].sort((a, b) => a - b);
  const scored = turns.filter((t) => t.eval);
  const name = session.candidate.member?.name ?? "Custom candidate";
  const role = session.candidate.member?.jobRole;
  const started = new Date(session.startedAt);

  const evidenceFor = (kind: EvidenceItem["kind"], item: string) =>
    evidenceMap.filter((e) => e.kind === kind && e.item === item);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[820px] px-5 pb-24 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-rule py-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <LogoMark className="h-6 w-6 text-quill transition-colors group-hover:text-quill-bright" />
          <span className="font-voice text-[1.375rem] leading-none text-ink">Viva</span>
        </Link>
        <div className="flex items-center gap-5 font-mono text-data text-faint">
          <span>session {sessionId.slice(0, 8)}</span>
          <PrintButton />
        </div>
      </header>

      <section className="py-10">
        <p className="field-label">Interview report</p>
        <h1 className="mt-2 font-voice text-[2rem] font-medium leading-tight text-ink">
          {name}
        </h1>
        <p className="mt-1 text-ui text-dim">
          {role}
          {role && " · "}
          {started.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>

        <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3 border-y border-rule py-4 font-mono text-data">
          <Stat label="questions" value={String(turns.length)} />
          <Stat label="days covered" value={`${covered.length}`} />
          <Stat
            label="strong answers"
            value={String(scored.filter((t) => (t.eval!.score ?? 0) >= 0.7).length)}
          />
          <Stat
            label="weak answers"
            value={String(scored.filter((t) => (t.eval!.score ?? 0) < 0.4).length)}
          />
        </dl>

        <p className="mt-8 max-w-[62ch] font-voice text-voice leading-relaxed text-ink">
          {feedback.summary}
        </p>
      </section>

      <section className="border-t border-rule py-8">
        <h2 className="field-label">Curriculum ground covered</h2>
        <div className="mt-4">
          <Ledger
            marks={marks}
            variant="full"
            activeDays={covered}
            label={`${name}'s cohort ledger with the days this interview covered`}
          />
        </div>
        <p className="mt-3 max-w-[62ch] text-ui-sm text-dim">
          Lit columns are the days this interview examined. The marks beneath
          them are the cohort record: one stroke per attempt, a hollow box for a
          skipped day, a brass rule for one never passed.
        </p>
      </section>

      <EvidenceSection
        title="Strengths"
        items={feedback.strengths}
        kind="strength"
        evidenceFor={evidenceFor}
        emptyNote="No standout strengths surfaced in this session."
      />

      <EvidenceSection
        title="Gaps"
        items={feedback.gaps}
        kind="gap"
        evidenceFor={evidenceFor}
        emptyNote="No clear gaps surfaced in this session."
      />

      <section className="border-t border-rule py-8">
        <h2 className="field-label">What to do next</h2>
        <ol className="mt-4 space-y-3">
          {feedback.next.map((item, i) => (
            <li key={i} className="grid grid-cols-[1.5rem_1fr] gap-3">
              <span className="font-mono text-data text-faint leading-6">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="max-w-[62ch] text-body text-ink">{item}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-rule py-8">
        <h2 className="field-label">Full transcript</h2>
        <ol className="mt-4 space-y-7">
          {turns.map((turn, i) => (
            <li key={i}>
              <p className="font-mono text-data text-dim">
                <span className="text-faint">Q{i + 1}</span>
                <span className="text-faint"> · </span>
                <span className="text-quill">Day {turn.day}</span>
                <span className="text-faint">
                  {" "}
                  · {dayTitleFor(turn.day)} · L{turn.difficulty}
                </span>
                {turn.eval && (
                  <span className="text-faint">
                    {" "}
                    · {turn.eval.classification} {turn.eval.score.toFixed(2)}
                  </span>
                )}
              </p>
              <p className="mt-1.5 max-w-[62ch] font-voice text-[1.0625rem] leading-relaxed text-ink">
                {turn.q}
              </p>
              {turn.a && (
                <p className="mt-2.5 max-w-[62ch] border-l border-rule pl-4 text-ui text-dim">
                  {turn.a}
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>

      <footer className="no-print border-t border-rule py-6">
        <Link
          href="/"
          className="inline-block bg-quill-bright px-5 py-2 text-ui font-medium text-ground transition-opacity hover:opacity-90"
        >
          Examine another candidate
        </Link>
      </footer>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-faint">{label}</dt>
      <dd className="mt-0.5 text-[1.125rem] text-ink">{value}</dd>
    </div>
  );
}

function EvidenceSection({
  title,
  items,
  kind,
  evidenceFor,
  emptyNote,
}: {
  title: string;
  items: string[];
  kind: EvidenceItem["kind"];
  evidenceFor: (kind: EvidenceItem["kind"], item: string) => EvidenceItem[];
  emptyNote: string;
}) {
  const tone = kind === "strength" ? "text-quill" : "text-lamp";
  return (
    <section className="border-t border-rule py-8">
      <h2 className="field-label">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-ui text-dim">{emptyNote}</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {items.map((item, i) => {
            const evidence = evidenceFor(kind, item);
            return (
              <li key={i} className="border-b border-rule-soft pb-4 last:border-0 last:pb-0">
                <div className="grid grid-cols-[0.75rem_1fr] gap-3">
                  <span aria-hidden className={`font-mono leading-6 ${tone}`}>
                    {kind === "strength" ? "+" : "!"}
                  </span>
                  <div className="min-w-0">
                    <p className="max-w-[62ch] text-body text-ink">{item}</p>

                    {evidence.length > 0 && (
                      <details className="group mt-2">
                        <summary className="cursor-pointer list-none font-mono text-data text-dim underline decoration-rule underline-offset-4 transition-colors hover:text-quill">
                          <span className="group-open:hidden">
                            show the evidence
                          </span>
                          <span className="hidden group-open:inline">
                            hide the evidence
                          </span>
                        </summary>
                        <div className="mt-2.5 space-y-2.5">
                          {evidence.map((e, j) => (
                            <blockquote
                              key={j}
                              className="border-l border-rule pl-4"
                            >
                              <p className="max-w-[60ch] font-voice text-[1rem] italic leading-relaxed text-ink">
                                &ldquo;{e.quote}&rdquo;
                              </p>
                              <cite className="mt-1 block font-mono text-data not-italic text-faint">
                                Day {e.day} · {dayTitleFor(e.day)} ·{" "}
                                {moduleTitleFor(e.day)}
                              </cite>
                            </blockquote>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
