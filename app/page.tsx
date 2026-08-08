import Link from "next/link";
import { CANDIDATES } from "@/lib/journey";
import { CandidatePicker } from "@/components/candidate-picker";

export default function Home() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[1240px] px-5 pb-24 sm:px-8">
      <header className="flex flex-wrap items-baseline justify-between gap-4 border-b border-rule py-6">
        <span className="font-voice text-[1.375rem] tracking-[-0.01em] text-ink">
          Viva
          <span className="ml-2.5 font-sans text-data uppercase tracking-[0.16em] text-faint">
            viva voce
          </span>
        </span>
        <nav className="flex items-center gap-5 font-mono text-data text-dim">
          <Link href="/api-docs" className="transition-colors hover:text-quill">
            api
          </Link>
          <a
            href="https://github.com/MONSTERBOY110/Viva"
            className="transition-colors hover:text-quill"
          >
            source
          </a>
          <Link href="/api/health" className="transition-colors hover:text-quill">
            health
          </Link>
        </nav>
      </header>

      <section className="grid gap-6 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-end lg:gap-16 lg:py-14">
        <h1 className="font-voice text-display font-medium text-ink">
          The interviewer that
          <br />
          already read your homework.
        </h1>
        <p className="max-w-[44ch] text-body text-dim lg:pb-1.5">
          Viva examines graduates of the 31 day AI cohort. Every question is
          drawn from what this person actually built, retried, or skipped, and
          you can watch it decide, question by question.
        </p>
      </section>

      <CandidatePicker candidates={CANDIDATES} />

      <footer className="mt-24 border-t border-rule pt-6 font-mono text-data text-faint">
        <p>
          Built for the ABTalks Vibe Code Hackathon, Problem Statement 2.
          Contract endpoint at{" "}
          <Link
            href="/api-docs"
            className="text-dim underline decoration-rule underline-offset-4 hover:text-quill"
          >
            POST /api/interview
          </Link>
        </p>
      </footer>
    </main>
  );
}
