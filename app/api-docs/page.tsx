import Link from "next/link";
import { CANDIDATES } from "@/lib/journey";
import { ContractPlayground } from "@/components/contract-playground";

export const metadata = {
  title: "Viva API, the interview contract",
};

const START_REQ = `POST /api/interview
Content-Type: application/json

{
  "sessionId": "abc-123",
  "candidate": { ...candidate object }
}`;

const START_RES = `200 OK

{
  "reply": "Welcome, David Miller...",
  "done": false
}`;

const TURN_REQ = `POST /api/interview

{
  "sessionId": "abc-123",
  "message": "A vector database stores embeddings..."
}`;

const TURN_RES = `200 OK

{
  "reply": "Since you mentioned that SQL lacks...",
  "done": false
}`;

const END_RES = `200 OK

{
  "reply": "That completes our interview...",
  "done": true,
  "feedback": {
    "summary": "David shows solid high level...",
    "strengths": ["..."],
    "gaps": ["..."],
    "next": ["..."]
  }
}`;

export default function ApiDocsPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[900px] px-5 pb-24 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-rule py-6">
        <Link
          href="/"
          className="font-voice text-[1.375rem] text-ink transition-colors hover:text-quill"
        >
          Viva
        </Link>
        <nav className="flex items-center gap-5 font-mono text-data text-dim">
          <Link href="/" className="transition-colors hover:text-quill">
            roster
          </Link>
          <Link href="/api/health" className="transition-colors hover:text-quill">
            health
          </Link>
        </nav>
      </header>

      <section className="py-10">
        <h1 className="font-voice text-[2rem] font-medium leading-tight text-ink">
          The interview contract
        </h1>
        <p className="mt-3 max-w-[62ch] text-body text-dim">
          One endpoint, no authentication, state keyed by{" "}
          <code className="font-mono text-quill">sessionId</code>. The shapes
          below are exactly those in the problem statement&apos;s
          technical-spec.md. Run them yourself at the bottom of this page.
        </p>
      </section>

      <section className="border-t border-rule py-8">
        <h2 className="field-label">1. Start the interview</h2>
        <p className="mt-2 max-w-[62ch] text-ui text-dim">
          The first request for a session carries the candidate object. Viva
          reads the mission history, plans five or six topics across at least
          four curriculum days, and opens on the one that matters most.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <CodeBlock label="request" code={START_REQ} />
          <CodeBlock label="response" code={START_RES} />
        </div>
      </section>

      <section className="border-t border-rule py-8">
        <h2 className="field-label">2. Each turn</h2>
        <p className="mt-2 max-w-[62ch] text-ui text-dim">
          Every later request carries the candidate&apos;s latest answer. Viva
          evaluates it, decides whether to drill, escalate, switch topic or
          wrap, and asks the next question.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <CodeBlock label="request" code={TURN_REQ} />
          <CodeBlock label="response" code={TURN_RES} />
        </div>
      </section>

      <section className="border-t border-rule py-8">
        <h2 className="field-label">3. The end</h2>
        <p className="mt-2 max-w-[62ch] text-ui text-dim">
          After at least eight questions across at least four distinct
          curriculum days, Viva wraps and returns structured feedback.
        </p>
        <div className="mt-4 md:max-w-[28rem]">
          <CodeBlock label="final response" code={END_RES} />
        </div>
      </section>

      <section className="border-t border-rule py-8">
        <h2 className="field-label">Behaviour a test harness can rely on</h2>
        <ul className="mt-4 space-y-2.5">
          <Guarantee>
            Never a 5xx. A malformed body returns 400 with a JSON error, an
            unknown sessionId without a candidate returns 200 and restarts in
            character, and any unexpected failure returns 200 with a graceful
            interviewer line.
          </Guarantee>
          <Guarantee>
            At least 8 questions across at least 4 distinct curriculum days,
            wrapping between 10 and 12 and hard capped at 14. Enforced by pure
            TypeScript guardrails, not by asking the model nicely.
          </Guarantee>
          <Guarantee>
            State survives between requests on serverless via Upstash Redis,
            keyed by sessionId with a 48 hour lifetime.
          </Guarantee>
          <Guarantee>
            The interview still completes with valid feedback if the language
            model is unreachable. Every stage has a deterministic fallback.
          </Guarantee>
          <Guarantee>
            Extra response fields are additive only. Contract fields are never
            renamed or removed. Panel data lives on a separate
            <code className="ml-1 font-mono text-quill">
              GET /api/session/[id]
            </code>
            .
          </Guarantee>
        </ul>
      </section>

      <section className="border-t border-rule py-8">
        <h2 className="font-voice text-[1.5rem] text-ink">Run it now</h2>
        <p className="mt-2 max-w-[62ch] text-ui text-dim">
          These calls go to this deployment&apos;s live endpoint. Responses are
          printed exactly as returned.
        </p>
        <div className="mt-5">
          <ContractPlayground candidates={CANDIDATES} />
        </div>
      </section>
    </main>
  );
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  return (
    <div>
      <p className="font-mono text-data text-faint">{label}</p>
      <pre className="mt-1.5 overflow-x-auto border border-rule bg-panel p-3.5 font-mono text-[0.75rem] leading-relaxed text-ink">
        {code}
      </pre>
    </div>
  );
}

function Guarantee({ children }: { children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[0.75rem_1fr] gap-3">
      <span aria-hidden className="font-mono leading-6 text-quill">
        +
      </span>
      <span className="max-w-[62ch] text-ui text-ink">{children}</span>
    </li>
  );
}
