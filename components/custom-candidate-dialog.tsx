"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Candidate } from "@/lib/types";

const TEMPLATE = `{
  "member": {
    "id": "CAND-999",
    "name": "Your Name",
    "jobRole": "Backend Engineer",
    "yearsExperience": 4,
    "education": "B.Tech Computer Science",
    "status": "COMPLETED"
  },
  "missions": [
    { "day": 7,  "title": "Embeddings Explained",         "passed": true,  "attempts": 4 },
    { "day": 12, "title": "Prompt Engineering",           "passed": true,  "attempts": 1 },
    { "day": 23, "title": "Model Context Protocol (MCP)", "passed": false, "attempts": 3 },
    { "day": 28, "title": "Docker & Kubernetes",          "skipped": true }
  ],
  "signals": { "commitDays": 21, "missionsCompleted": 26, "missionsFirstTry": 9 }
}`;

export function CustomCandidateDialog({
  onStart,
}: {
  onStart: (candidate: Candidate) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(TEMPLATE);
  const [error, setError] = useState<string | null>(null);

  function start() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      setError(
        "That isn't valid JSON. Check for a trailing comma or a missing brace.",
      );
      return;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      setError("Paste a single candidate object, not an array or a bare value.");
      return;
    }
    setError(null);
    setOpen(false);
    onStart(parsed as Candidate);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="-my-2 py-2 font-mono text-data text-dim underline decoration-rule underline-offset-4 transition-colors hover:text-quill hover:decoration-quill">
        examine a custom candidate
      </DialogTrigger>

      <DialogContent className="max-w-2xl gap-0 border-rule bg-panel p-0">
        <DialogHeader className="border-b border-rule-soft px-6 py-5 text-left">
          <DialogTitle className="font-voice text-[1.25rem] font-normal text-ink">
            Examine a candidate of your own
          </DialogTitle>
          <DialogDescription className="text-ui text-dim">
            Paste any candidate object in the cohort schema. Viva reads the
            missions (attempts, skips, failures) and plans the interview from
            them. Unknown fields are ignored, missing ones are tolerated.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5">
          <label htmlFor="custom-json" className="field-label">
            Candidate JSON
          </label>
          <textarea
            id="custom-json"
            value={value}
            spellCheck={false}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            rows={14}
            className="mt-2 w-full resize-y border border-rule bg-ground p-3 font-mono text-[0.78125rem] leading-relaxed text-ink outline-none focus-visible:border-quill"
          />
          <p
            role={error ? "alert" : undefined}
            className="mt-2 min-h-[1.4em] text-ui-sm text-lamp"
          >
            {error}
          </p>
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-3 border-t border-rule-soft px-6 py-4">
          <button
            type="button"
            onClick={() => {
              setValue(TEMPLATE);
              setError(null);
            }}
            className="-my-2 py-2 font-mono text-data text-dim underline decoration-rule underline-offset-4 hover:text-ink"
          >
            reset to template
          </button>
          <button
            type="button"
            onClick={start}
            className="min-h-11 bg-quill-bright px-4 py-2 text-ui font-medium text-ground transition-opacity hover:opacity-90 active:opacity-80"
          >
            Begin interview
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
