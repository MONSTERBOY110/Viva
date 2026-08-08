import { CANDIDATES } from "@/lib/journey";
import { CandidatePicker } from "@/components/candidate-picker";
import { Wordmark } from "@/components/logo";
import { voiceEnabled } from "@/lib/voice";
import {
  EvidenceSection,
  JudgeSection,
  LandingFooter,
  MindSection,
  SpokenSection,
  TranscriptSection,
} from "@/components/landing-sections";
import Link from "next/link";

export default function Home() {
  const spoken = voiceEnabled();

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[1240px] px-5 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-rule py-6">
        <Wordmark />
        <nav className="flex items-center gap-5 font-mono text-data text-dim">
          <Link href="/api-docs" className="-my-2 py-2 transition-colors hover:text-quill">
            api
          </Link>
          <a
            href="https://github.com/MONSTERBOY110/Viva"
            className="-my-2 py-2 transition-colors hover:text-quill"
          >
            source
          </a>
          <Link href="/api/health" className="-my-2 py-2 transition-colors hover:text-quill">
            health
          </Link>
        </nav>
      </header>

      {/* The thesis, then the action immediately below it. */}
      <section className="grid gap-6 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-end lg:gap-16 lg:py-16">
        <h1 className="text-balance font-voice text-[2rem] font-medium leading-[1.08] tracking-[-0.02em] text-ink sm:text-display">
          The interviewer that
          <br className="hidden sm:inline" /> already read your homework.
        </h1>
        <div className="max-w-[44ch] lg:pb-1.5">
          <p className="text-body text-dim">
            Viva examines graduates of the 31 day AI cohort. Every question is
            drawn from what this person actually built, retried, or skipped, and
            you can watch it decide, question by question.
          </p>
          {spoken && (
            <p className="mt-3 flex items-start gap-2 text-ui text-dim">
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden
                className="mt-1 shrink-0 text-quill"
              >
                <path
                  d="M3 6.2h2.2L8.4 3.4v9.2L5.2 9.8H3z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
                <path
                  d="M10.8 6.1a2.7 2.7 0 0 1 0 3.8M12.6 4.3a5.2 5.2 0 0 1 0 7.4"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
              <span>
                <span className="text-ink">It can also examine you aloud.</span>{" "}
                A viva voce is an oral exam, so turn on hands free and answer by
                speaking.
              </span>
            </p>
          )}
        </div>
      </section>

      <CandidatePicker candidates={CANDIDATES} />

      {/* Why it is not a thin wrapper, shown with real output. */}
      <div className="mt-20">
        <TranscriptSection />
        <MindSection />
        <EvidenceSection />
        {spoken && <SpokenSection />}
        <JudgeSection />
      </div>

      <LandingFooter />
    </main>
  );
}
