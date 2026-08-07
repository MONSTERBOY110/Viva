# PROMPTS.md — AI Usage Log

> **Vibe Code Hackathon requirement:** this log is how organizers verify the build was genuinely
> AI-assisted during the hackathon window. It is checked automatically (Stage 1) and reviewed
> against the commit history and features (Stage 2).
>
> **Discipline:** append an entry after every significant AI working session, *as it happens*.
> Entries must correspond to real features and real commits.

**Project:** Viva — AI Interview Agent (Problem Statement 2)
**Builder:** Subhojyoti Maity (solo)
**Primary AI tools:** Claude Code (Opus/Fable, agentic coding), Gemini API (product runtime)
**Window:** Fri 7 Aug 8:00 PM IST → Sun 9 Aug 8:00 PM IST

---

## Format

Each entry:

```
### <n>. <short title>
**When:** <date, approx time IST>
**Tool:** <Claude Code / other>
**Goal:** <what I was trying to get done>
**Prompt (representative):**
> the actual prompt or a faithful condensation of the session's key prompts
**Outcome:** <what was produced; which files/commits> 
**Steering notes:** <what I corrected, rejected, or redirected — judges score "how well you steered the AI">
```

---

## Entries

### 0. Idea selection & docs (pre-repo)
**When:** Fri 7 Aug, ~8:45–10:00 PM IST
**Tool:** Claude Code (Opus, planning session)
**Goal:** Read the hackathon rules/problem statements via Playwright, pick the problem statement with the best win probability, design the concept, and produce PRD/TRD/execution docs.
**Prompt (representative):**
> go to https://www.abtalks.in/hackathon/submission use playwright … read through the rules, the guidelines, and the problem statements and think of a unique idea that will win this hackathon … make a PRD.md and a TRD.md
**Outcome:** Chose PS2 (Interview Agent). Concept: adaptive interviewer with a live "Interviewer Brain" panel + evidence-linked feedback + Breeth long-term memory. Produced PRD.md, TRD.md, HACKATHON.md, CLAUDE.md, EXECUTION-PLAN.md.
**Steering notes:** Compared win probability across all three problem statements (competition density, objective testability, judge incentives) before committing; locked stack to Gemini free tier + Vercel + Upstash to eliminate cost/uptime risk during the judging window.

<!-- Append new entries below as the build progresses. Do not backfill or fabricate. -->

### 1. Foundation: scaffold, contract endpoint, judge-sim, first deploy
**When:** Fri 7 Aug, ~9:30–10:30 PM IST
**Tool:** Claude Code (Fable 5)
**Goal:** Stand up the Stage-1 skeleton: Next.js scaffold merged into the docs-only repo, a contract-exact canned `POST /api/interview` + `GET /api/health`, a scripted judge-simulation test, and a live Vercel URL verified against it — all tonight (eligibility gate).
**Prompt (representative):**
> You are the implementing agent for Viva … STEP 0 — orient: read HACKATHON.md, PRD.md, TRD.md, EXECUTION-PLAN.md, docs/technical-spec.md fully, in order … STEP 1 — tonight's block: scaffold Next.js 15 + TypeScript + Tailwind (App Router) into the non-empty repo … Implement POST /api/interview with a hardcoded canned interview flow that is exactly contract-shaped (start → turns → done+feedback) … State = in-memory Map tonight behind the SessionStore interface … Write scripts/judge-sim.ts — scripted full-interview test against any base URL asserting contract shapes every turn … Walk me through deploying to Vercel.
**Outcome:** Next.js 15.5.23 scaffold (`create-next-app@15`, merged without touching provided docs/data); `lib/types.ts`, `lib/store/session.ts` (SessionStore interface + in-memory impl), `lib/engine/canned.ts` (8 questions across 8 curriculum days), `app/api/interview/route.ts` with defensive paths (400 JSON on malformed body, 200 in-character recovery on unknown session, outer catch — never 5xx), `app/api/health/route.ts`; `scripts/judge-sim.ts` (health probe, full CAND-001 interview with mixed-quality scripted answers, shape assertions every turn, feedback validation, defensive-path checks). Deployed to https://viva-bay.vercel.app — judge-sim 77/77 green against production. Commit: `progress1`.
**Steering notes:** Pinned `create-next-app@15` rather than latest (no new-major risk mid-hackathon) and stripped `--turbopack` from `next build` (beta) so Vercel builds stay on the stable path. Diagnosed a dev-server "hang" as my own tooling mistake (stdout piped to a dead process) instead of letting the agent rewrite working endpoint code. Enforced my git policy: the agent prepares changes; I review, commit, and push myself. Production judge-sim exposed real in-memory session loss across serverless instances (interview stretched to the 14-question ceiling via recovery restarts) → promoted Upstash Redis wiring to first task tomorrow morning.

### 2. Redis session store + the full interview engine (pulled forward from Saturday)
**When:** Fri 7 Aug, ~10:30 PM–11:00 PM IST
**Tool:** Claude Code (Fable 5)
**Goal:** Close the serverless state-loss risk with Upstash Redis, then build the entire interview engine — deterministic policy brain, Gemini adapter, planner, turn pipeline, feedback generator — so the only key-dependent step left is live testing.
**Prompt (representative):**
> Continue. (× several — the agent worked through the Redis wiring, verified current Gemini model names and the @google/genai SDK surface against ai.google.dev and the installed package types before writing the adapter, then built the engine per TRD §4–§5.)
**Outcome:** `lib/store/session.ts` gains RedisSessionStore (Upstash, 48h TTL, `UPSTASH_*`/`KV_*` env names, in-memory fallback) — after I provisioned Upstash via Vercel Marketplace and pushed, prod judge-sim went from a 14-question limp (state loss) to a clean 8-question run, `/api/health` reports `store:"redis"`. Engine: `lib/engine/policy.ts` (topic selection from missions/signals, guardrails: coverage floor, wrap window 10–12/cap 14, no-3-consecutive, dont-know kindness, earned escalation, pre-call directives, confidence EMA) with 25 vitest tests incl. a full offline interview simulation; `lib/llm/gemini.ts` (verified models `gemini-3.5-flash` → `gemini-3.1-flash-lite`, JSON mode via responseJsonSchema + zod, backoff, timeout, fallback chain); prompts in `lib/llm/prompts/`; `planner/turn/feedback` engine modules — every stage has a deterministic fallback, proven by judge-sim 69/69 offline on the engine-wired route. CAND-004's opener now cites "5 attempts on Day 8" with zero LLM calls.
**Steering notes:** Made the agent verify Gemini model names + SDK surface from the installed package's type definitions, not doc summaries (the docs page showed a different, newer API family — `interactions` — that the installed SDK treats as a separate subsystem). Chose to wire the engine into the contract route tonight because the offline fallback path is test-proven, meaning tomorrow's key drop is config, not code. Thinking budget deliberately left at model default until measurable with a real key.

### 3. Live LLM bring-up: debugging, latency tuning, first real interviews
**When:** Fri 7 Aug, ~11:25 PM–11:50 PM IST
**Tool:** Claude Code (Fable 5) + Gemini API (live)
**Goal:** With the real GEMINI_API_KEY in place: get live adaptive interviews working end to end, measure and fix latency, validate the full contract against the live engine.
**Prompt (representative):**
> I have added the Gemini API key in Vercel also and in our local code. [+ claimed the Breeth code — asked what to do with it]
**Outcome:** First live run returned only backstop replies — the agent isolated it by testing layers separately (raw SDK: fine; production schemas through the adapter: fine) and found the real cause: unfilled `.env.example` placeholder Upstash creds in `.env.local` made the store target a non-existent host, and the route's judge-protection catch masked it. Fixed with a placeholder guard in `lib/store/session.ts`. Then measured `thinkingBudget` on gemini-3.5-flash (0 → ~2s/turn, default → ~6s, same quality) and made 0 the adapter default. Fixed opener prose (second-person reasonDetail rule in the planner prompt). Live results: adaptive follow-ups that quote the candidate and escalate to HNSW internals, kind dont-know pivots, judge-sim 53/53 in 44s against the live engine, and a 12-question live report whose gaps[] even flagged the test script's canned-answer mismatches as "prepared answers". Diagnostic scripts kept in `scripts/{gemini,engine}-smoke.ts`, `scripts/thinking-budget-test.ts`. Breeth: claimed key turned out to still be a placeholder in `.env.local` (write test → 401); after the real `ck_live_…` key went in, the full round-trip was verified — POST /v1/episodes (200, entities+edges extracted) then POST /v1/search reading the fact back after the ~15s async pipeline. The dashboard's "test write before building" requirement is done; API surface documented for tomorrow's memory feature.
**Steering notes:** Refused to guess at the silent failure — forced layer-by-layer isolation instead of code churn, which exposed a config issue rather than a code bug. Latency decision made on measurement, not guesswork (3× win from thinking budget 0 with no observable quality loss on this task shape). All debugging done with API keys masked from output.

### 4. Breeth long-term memory: the re-interview continuity moment (pulled forward from Saturday night)
**When:** Fri 7 Aug ~11:55 PM – Sat 8 Aug ~12:20 AM IST
**Tool:** Claude Code (Fable 5) + Breeth API (live) + Gemini API (live)
**Goal:** Cross-session candidate memory (TRD §6): write an interview summary to Breeth on wrap, recall it on the next interview of the same candidate, and open with continuity.
**Prompt (representative):**
> I have added the Breeth API key… changed BREETH_ENABLED to true… added both to Vercel.
**Outcome:** `lib/store/breeth.ts` — feature-flagged, fail-silent MemoryStore over the verified API (`POST /v1/episodes`, `POST /v1/search`, per-candidate `group_id`); recall on the start request (4s budget) feeding `priorMemories` into planner/turn/feedback prompts + a continuity line in the opener; memory write via Next 15 `after()` once the response is sent. 6 new vitest tests pin the no-op behavior when disabled/misconfigured (31 total). Verified live end-to-end through the route: wrap → `[breeth] memory written (200)` → re-interview start recalls 3 facts → "I also remember our previous conversation — I'll be checking how far you've come since."
**Steering notes:** Two real integration bugs found by testing rather than assuming: (1) Breeth's synchronous entity extraction can exceed 4s, so writes needed their own 45s budget separate from the recall path; (2) async-mode episode writes can lag indefinitely before becoming searchable — switched to blocking writes (`?wait_seconds=30`), free because they run in `after()` post-response. Also fixed a prompt-compliance bug where the LLM echoed the opener's sentence stem into reasonDetail — corrected in the prompt AND defensively stripped in code.
