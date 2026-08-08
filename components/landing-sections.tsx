import Link from "next/link";
import { LogoMark } from "@/components/logo";

/**
 * The explanatory half of the landing page. Every example below is real
 * output from a recorded interview, not written copy, because the fastest way
 * to prove this is not a thin wrapper is to show what it actually says.
 */

export function TranscriptSection() {
  return (
    <section className="border-t border-rule py-16 sm:py-20">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16">
        <div>
          <h2 className="font-voice text-[1.75rem] leading-tight text-ink">
            It opens with something only you could be asked.
          </h2>
          <p className="mt-4 max-w-[42ch] text-body text-dim">
            Before the first question, Viva reads the candidate&apos;s 31 days
            and plans five or six topics across at least four curriculum days.
            The opening line names the thing that actually went wrong.
          </p>
          <p className="mt-4 max-w-[42ch] text-ui text-faint">
            Below is a real exchange with David Miller, a Business Analyst who
            needed five attempts on vector databases.
          </p>
        </div>

        <div className="min-w-0">
          <div className="border-l border-rule pl-5 sm:pl-7">
            <p className="font-mono text-data text-dim">
              <span className="text-faint">Q1</span>
              <span className="text-faint"> · </span>
              <span className="text-quill">Day 8</span>
              <span className="text-faint"> · Vector Databases Overview · L1</span>
            </p>
            <p className="voice mt-2">
              We&apos;ll start where it matters most: you needed 5 attempts to
              pass the Vector Databases Overview on Day 8. When is a plain SQL
              database the wrong tool for retrieval, and what does a vector
              database do differently under the hood?
            </p>

            <div className="mt-6 border-l border-rule pl-5">
              <p className="field-label">The candidate answers</p>
              <p className="mt-1.5 max-w-[62ch] text-body text-dim">
                A vector database stores embeddings and searches by similarity
                using ANN indexes like HNSW, whereas SQL needs exact predicates.
              </p>
            </div>

            <p className="mt-6 font-mono text-data text-dim">
              <span className="text-faint">Q2</span>
              <span className="text-faint"> · </span>
              <span className="text-quill">Day 10</span>
              <span className="text-faint"> · Retrieval &amp; Matching · L2</span>
            </p>
            <p className="voice mt-2">
              That is a precise summary of the architectural divide. Since you
              mentioned that SQL lacks the ability to handle fuzzy natural
              language, how would you design a hybrid search system that
              combines exact keyword filtering with vector similarity?
            </p>
          </div>

          <p className="mt-5 max-w-[62ch] text-ui text-faint">
            It quoted the candidate back to them, escalated from recall to
            application, and moved to a different curriculum day. Say &ldquo;I
            don&apos;t know&rdquo; instead and it drops the difficulty, records
            the gap, and moves on kindly.
          </p>
        </div>
      </div>
    </section>
  );
}

export function MindSection() {
  const rules = [
    "at least 8 questions, across at least 4 distinct curriculum days",
    "wraps between 10 and 12 questions, hard capped at 14",
    "never three questions in a row on the same day",
    "an admitted gap lowers difficulty, it never escalates",
    "a difficulty increase after a weak answer is blocked",
  ];

  return (
    <section className="border-t border-rule py-16 sm:py-20">
      <h2 className="max-w-[24ch] font-voice text-[1.75rem] leading-tight text-ink">
        Most interview agents are a black box. This one shows its work.
      </h2>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-16">
        <div className="min-w-0">
          <p className="max-w-[52ch] text-body text-dim">
            While the candidate answers, the Interviewer Mind panel shows the
            reasoning behind the current question, which curriculum days are
            covered against the minimum, confidence per module updating live,
            and any rule that had to override the model.
          </p>

          <div className="mt-6 max-w-[34rem] border border-rule bg-panel">
            <div className="border-b border-rule px-4 py-3">
              <span className="font-voice text-[1rem] text-ink">
                Interviewer mind
              </span>
            </div>
            <div className="space-y-2 p-4">
              <p className="field-label">Now probing</p>
              <p className="font-mono text-ui-sm text-quill">
                Day 8 <span className="text-dim">· Embeddings &amp; Vector Search</span>
              </p>
              <p className="font-voice text-[1rem] italic leading-relaxed text-ink">
                opening probe (struggled): you needed 5 attempts to pass Vector
                Databases Overview on Day 8
              </p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="field-label">Rules the model cannot break</h3>
          <p className="mt-3 max-w-[40ch] text-ui text-dim">
            The problem statement&apos;s minimums are contractual, so they are
            enforced in pure TypeScript and unit tested, not requested politely
            from a language model.
          </p>
          <ul className="mt-4 space-y-2.5">
            {rules.map((rule) => (
              <li
                key={rule}
                className="grid grid-cols-[0.75rem_1fr] gap-2.5 text-ui-sm text-ink"
              >
                <span aria-hidden className="font-mono leading-5 text-quill">
                  +
                </span>
                <span className="max-w-[40ch]">{rule}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function EvidenceSection() {
  return (
    <section className="border-t border-rule py-16 sm:py-20">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16">
        <div>
          <h2 className="font-voice text-[1.75rem] leading-tight text-ink">
            No claim without the candidate&apos;s own words.
          </h2>
          <p className="mt-4 max-w-[42ch] text-body text-dim">
            Generic feedback is unfalsifiable and useless. Every strength and
            every gap in a Viva report opens to reveal the exact sentence that
            produced it, and the curriculum day to go back to.
          </p>
        </div>

        <div className="min-w-0">
          <div className="border border-rule bg-panel p-5">
            <div className="grid grid-cols-[0.75rem_1fr] gap-3">
              <span aria-hidden className="font-mono leading-6 text-quill">
                +
              </span>
              <div className="min-w-0">
                <p className="max-w-[54ch] text-body text-ink">
                  Clear understanding of vector database fundamentals and ANN
                  indexing
                </p>
                <blockquote className="mt-3 border-l border-rule pl-4">
                  <p className="max-w-[54ch] font-voice text-[1rem] italic leading-relaxed text-ink">
                    &ldquo;A vector database stores embeddings and searches by
                    similarity with ANN indexes like HNSW&rdquo;
                  </p>
                  <cite className="mt-1.5 block font-mono text-data not-italic text-faint">
                    Day 8 · Vector Databases Overview · Embeddings &amp; Vector
                    Search
                  </cite>
                </blockquote>
              </div>
            </div>
          </div>
          <p className="mt-4 max-w-[56ch] text-ui text-faint">
            The report also carries the full transcript, the days covered drawn
            in the same notation as the roster, and study steps that name the
            day to revisit.
          </p>
        </div>
      </div>
    </section>
  );
}

export function SpokenSection() {
  return (
    <section className="border-t border-rule py-16 sm:py-20">
      <div className="max-w-[60ch]">
        <h2 className="font-voice text-[1.75rem] leading-tight text-ink">
          A viva voce is an oral exam. So it can examine you aloud.
        </h2>
        <p className="mt-4 text-body text-dim">
          Turn on hands free and the examiner asks its question in a real voice,
          opens the microphone the moment it stops speaking, and submits your
          answer when you go quiet. You never touch the keyboard. The reasoning
          panel keeps updating beside it the whole time.
        </p>
        <p className="mt-4 text-ui text-faint">
          Audio streams rather than being synthesised and then sent, so speech
          begins in roughly six tenths of a second. Answering uses the browser
          itself, so it costs nothing.
        </p>
      </div>
    </section>
  );
}

export function JudgeSection() {
  return (
    <section className="border-t border-rule py-16 sm:py-20">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-16">
        <div className="min-w-0">
          <h2 className="font-voice text-[1.75rem] leading-tight text-ink">
            One endpoint, exactly to spec.
          </h2>
          <p className="mt-4 max-w-[52ch] text-body text-dim">
            <code className="font-mono text-ui text-quill">
              POST /api/interview
            </code>{" "}
            takes a candidate on the first call and a message on every call
            after, keyed by <code className="font-mono text-ui">sessionId</code>.
            It returns <code className="font-mono text-ui">reply</code> and{" "}
            <code className="font-mono text-ui">done</code> every turn, plus a{" "}
            <code className="font-mono text-ui">feedback</code> object at the
            end. Extra fields are additive only, and the reasoning panel reads a
            separate route so the graded response never changes shape.
          </p>
          <p className="mt-4 max-w-[52ch] text-ui text-faint">
            It never returns 5xx. A malformed body gets a 400 with a JSON error,
            an unknown session restarts politely in character, and if the
            language model is unreachable the interview still completes on
            deterministic fallbacks.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/api-docs"
              className="inline-flex min-h-11 items-center bg-quill-bright px-5 text-ui font-medium text-ground transition-opacity hover:opacity-90"
            >
              Run the contract live
            </Link>
            <a
              href="https://github.com/MONSTERBOY110/Viva"
              className="inline-flex min-h-11 items-center border border-rule px-5 text-ui text-ink transition-colors hover:border-quill"
            >
              Read the source
            </a>
          </div>
        </div>

        <div>
          <h3 className="field-label">Built on</h3>
          <dl className="mt-4 space-y-3">
            {[
              ["Engine", "Gemini 3.5 Flash, with a fallback model and a deterministic path"],
              ["State", "Upstash Redis, keyed by sessionId"],
              ["Memory", "Breeth, so a second interview remembers the first"],
              ["Voice", "ElevenLabs, streamed"],
              ["Surface", "Next.js 15, Tailwind v4, Radix, GSAP, react-three-fiber"],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[5rem_1fr] gap-3">
                <dt className="font-mono text-data text-faint">{k}</dt>
                <dd className="text-ui-sm text-dim">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="mt-4 border-t border-rule py-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex items-center gap-3">
          <LogoMark className="h-7 w-7 text-quill-dim" />
          <p className="max-w-[42ch] font-mono text-data text-faint">
            Built solo for the ABTalks Vibe Code Hackathon, Problem Statement 2.
          </p>
        </div>
        <nav className="flex flex-wrap items-center gap-5 font-mono text-data text-dim">
          <Link href="/api-docs" className="-my-2 py-2 hover:text-quill">
            api
          </Link>
          <a
            href="https://github.com/MONSTERBOY110/Viva"
            className="-my-2 py-2 hover:text-quill"
          >
            source
          </a>
          <Link href="/api/health" className="-my-2 py-2 hover:text-quill">
            health
          </Link>
        </nav>
      </div>
    </footer>
  );
}
