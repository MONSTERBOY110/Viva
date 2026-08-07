# CLAUDE.md — Viva (ABTalks Vibe Code Hackathon entry)

You are the implementing agent for **Viva**, an AI interview agent competing in a live 48-hour hackathon. The human you're working with is **Subhojyoti Maity** (solo participant). The mission is to **win**. Deadline: **Sunday 9 Aug 2026, 8:00 PM IST** (internal cutoff 6:30 PM).

## Read these first, in order
1. `HACKATHON.md` — rules, evaluation stages, disqualification triggers
2. `PRD.md` — what we're building and why it wins
3. `TRD.md` — architecture, API contract, engine design
4. `EXECUTION-PLAN.md` — the hour-by-hour schedule; always know which block we're in

## Non-negotiable rules (violating any of these can disqualify the submission)

1. **The API contract is sacred.** `POST /api/interview` request/response shapes in TRD §3 must match `docs/technical-spec.md` exactly. Extra fields additive-only. Judges run automated tests against it.
2. **Commit early, commit often.** Meaningful commits every 30–60 minutes of work. Never accumulate a huge diff. Commit messages describe real changes. The organizers' Stage 2 authenticity review analyzes commit cadence.
3. **PROMPTS.md is an eligibility gate, not documentation theater.** After every significant prompt/session, append an entry (see PROMPTS.md format). Entries must correspond to real features and commits.
4. **The live URL must always work.** Deploy to Vercel from hour 1; keep `main` always-green; `/api/health` must return 200. Their auto-verifier re-checks after the deadline.
5. **Never 500 to a judge.** Every error path returns a graceful, in-character JSON response (TRD §3 defensive paths).
6. **Don't gold-plate past the deadline.** Working & polished beats ambitious & broken. When in doubt, check EXECUTION-PLAN.md priorities: P0 → P1 → P2.

## Working style

- **Verify external facts at build time**: current Gemini model names/limits (`@google/genai`), Breeth API (https://docs.thebreeth.com), Upstash setup. Docs here were written before the build started.
- **Test against production**, not just localhost: `npx tsx scripts/judge-sim.ts https://<prod-url>` before every submission save.
- **Think like the judge**: they will interview as CAND-001 (star performer), CAND-004 (struggler, MBA, skipped Docker), and likely paste a weird custom candidate. Every feature is judged through that lens: originality, polish, AI steering.
- Keep `lib/engine/policy.ts` pure TypeScript (no LLM calls) — it's the unit-testable brain-stem and our Live Steer insurance.
- Secrets in `.env.local` / Vercel env vars only. `GEMINI_API_KEY`, Upstash creds, `BREETH_API_KEY`. Never commit keys; `.env.example` documents them.

## What "done" means

- [ ] `judge-sim` passes against production
- [ ] All PS2 minimums: ≥8 questions, ≥4 curriculum days, follow-ups, context, structured feedback, contract endpoint
- [ ] Brain panel demos beautifully on desktop + usable at 390px
- [ ] Evidence-linked report renders for all provided candidates
- [ ] README.md sells the project in 60 seconds (screenshots, architecture diagram, why-it's-different)
- [ ] PROMPTS.md complete and honest; commit history tells the 48h story
- [ ] Submission form saved with all 3 URLs — **early, then re-saved**

## The one-sentence pitch (keep every decision aligned to it)

*Every other interview agent asks questions; Viva reads the candidate's 31-day journey, plans like a human interviewer, shows its reasoning live, and proves every piece of feedback with the candidate's own words.*
