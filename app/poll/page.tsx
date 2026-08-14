"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { cn } from "@/lib/utils";

/**
 * Show of Hands: create a poll, share the link, watch results move live.
 * Built during the Top 8 live challenge. Inherits the Viva design system.
 */

type HistoryItem = { id: string; question: string; createdAt: string };

export default function CreatePollPage() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem("soh:history") ?? "[]"));
    } catch {
      setHistory([]);
    }
  }, []);

  async function create() {
    setError(null);
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (question.trim().length < 3) {
      setError("Give the poll a real question first.");
      return;
    }
    if (opts.length < 3) {
      setError("Fill in at least 3 options.");
      return;
    }
    if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) {
      setError("Two options say the same thing.");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim(), options: opts }),
      });
      const data = await res.json();
      if (!res.ok || !data.poll) {
        setError(data.error ?? "Could not create the poll.");
        setCreating(false);
        return;
      }
      try {
        localStorage.setItem(`soh:creator:${data.poll.id}`, data.creatorToken);
        const item: HistoryItem = {
          id: data.poll.id,
          question: data.poll.question,
          createdAt: data.poll.createdAt,
        };
        localStorage.setItem(
          "soh:history",
          JSON.stringify([item, ...history].slice(0, 20)),
        );
      } catch {
        // Private mode: history just does not persist.
      }
      router.push(`/poll/${data.poll.id}`);
    } catch {
      setError("Could not reach the server, try again.");
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[680px] px-5 pb-24 sm:px-8">
      <header className="flex items-center justify-between border-b border-rule py-5">
        <Link href="/" className="group flex items-center gap-2.5">
          <LogoMark className="h-5 w-5 text-quill transition-colors group-hover:text-quill-bright" />
          <span className="font-voice text-[1.25rem] leading-none text-ink">Viva</span>
        </Link>
        <span className="font-mono text-data uppercase tracking-[0.16em] text-faint">
          show of hands
        </span>
      </header>

      <section className="py-10">
        <h1 className="font-voice text-[2rem] font-medium leading-tight text-ink">
          Ask the room.
        </h1>
        <p className="mt-2 max-w-[48ch] text-body text-dim">
          Create a poll, share one link, and watch the bars move as votes land,
          live from any device.
        </p>

        <div className="mt-8">
          <label htmlFor="q" className="field-label">
            The question
          </label>
          <input
            id="q"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={200}
            placeholder="What should we name the team mascot?"
            className="mt-2 w-full border border-rule bg-raised px-3.5 py-3 font-voice text-[1.125rem] text-ink outline-none transition-colors focus-visible:border-quill"
          />
        </div>

        <div className="mt-6">
          <span className="field-label">Options, 3 to 4</span>
          <div className="mt-2 space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-6 font-mono text-data text-faint">
                  {String.fromCharCode(65 + i)}
                </span>
                <input
                  value={opt}
                  onChange={(e) =>
                    setOptions(options.map((o, j) => (j === i ? e.target.value : o)))
                  }
                  maxLength={80}
                  placeholder={`Option ${i + 1}`}
                  aria-label={`Option ${i + 1}`}
                  className="w-full border border-rule bg-raised px-3 py-2.5 text-body text-ink outline-none transition-colors focus-visible:border-quill"
                />
                {options.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setOptions(options.filter((_, j) => j !== i))}
                    aria-label={`Remove option ${i + 1}`}
                    className="min-h-11 px-2 font-mono text-data text-dim hover:text-lamp"
                  >
                    remove
                  </button>
                )}
              </div>
            ))}
          </div>
          {options.length < 4 && (
            <button
              type="button"
              onClick={() => setOptions([...options, ""])}
              className="mt-2.5 font-mono text-data text-dim underline decoration-rule underline-offset-4 hover:text-quill"
            >
              add a 4th option
            </button>
          )}
        </div>

        <p role={error ? "alert" : undefined} className="mt-4 min-h-[1.5em] text-ui text-lamp">
          {error}
        </p>

        <button
          type="button"
          onClick={create}
          disabled={creating}
          className={cn(
            "min-h-12 bg-quill-bright px-6 text-ui font-medium text-ground transition-opacity",
            "hover:opacity-90 active:opacity-80 disabled:opacity-50",
          )}
        >
          {creating ? "Creating..." : "Create the poll"}
        </button>
      </section>

      {history.length > 0 && (
        <section className="border-t border-rule py-8">
          <h2 className="field-label">Your polls</h2>
          <ul className="mt-3 divide-y divide-rule-soft">
            {history.map((h) => (
              <li key={h.id}>
                <Link
                  href={`/poll/${h.id}`}
                  className="group flex items-baseline justify-between gap-4 py-3"
                >
                  <span className="min-w-0 truncate text-body text-ink group-hover:text-quill">
                    {h.question}
                  </span>
                  <span className="shrink-0 font-mono text-data text-faint">
                    {h.id} →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
