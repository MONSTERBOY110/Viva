# PROMPTS.md, AI Usage Log

> **Vibe Code Hackathon requirement:** this log is how organizers verify the build was genuinely
> AI-assisted during the hackathon window. It is checked automatically (Stage 1) and reviewed
> against the commit history and features (Stage 2).
>
> **Discipline:** append an entry after every significant AI working session, *as it happens*.
> Entries must correspond to real features and real commits.

**Project:** Viva, AI Interview Agent (Problem Statement 2)
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
**Steering notes:** <what I corrected, rejected, or redirected, judges score "how well you steered the AI">
```

---

## Entries

### 0. Idea selection & docs (pre-repo)
**When:** Fri 7 Aug, ~8:45-10:00 PM IST
**Tool:** Claude Code (Opus, planning session)
**Goal:** Read the hackathon rules/problem statements via Playwright, pick the problem statement with the best win probability, design the concept, and produce PRD/TRD/execution docs.
**Prompt (representative):**
> go to https://www.abtalks.in/hackathon/submission use playwright … read through the rules, the guidelines, and the problem statements and think of a unique idea that will win this hackathon … make a PRD.md and a TRD.md
**Outcome:** Chose PS2 (Interview Agent). Concept: adaptive interviewer with a live "Interviewer Brain" panel + evidence-linked feedback + Breeth long-term memory. Produced PRD.md, TRD.md, HACKATHON.md, CLAUDE.md, EXECUTION-PLAN.md.
**Steering notes:** Compared win probability across all three problem statements (competition density, objective testability, judge incentives) before committing; locked stack to Gemini free tier + Vercel + Upstash to eliminate cost/uptime risk during the judging window.

<!-- Append new entries below as the build progresses. Do not backfill or fabricate. -->

### 1. Foundation: scaffold, contract endpoint, judge-sim, first deploy
**When:** Fri 7 Aug, ~9:30-10:30 PM IST
**Tool:** Claude Code (Fable 5)
**Goal:** Stand up the Stage-1 skeleton: Next.js scaffold merged into the docs-only repo, a contract-exact canned `POST /api/interview` + `GET /api/health`, a scripted judge-simulation test, and a live Vercel URL verified against it, all tonight (eligibility gate).
**Prompt (representative):**
> You are the implementing agent for Viva … STEP 0, orient: read HACKATHON.md, PRD.md, TRD.md, EXECUTION-PLAN.md, docs/technical-spec.md fully, in order … STEP 1, tonight's block: scaffold Next.js 15 + TypeScript + Tailwind (App Router) into the non-empty repo … Implement POST /api/interview with a hardcoded canned interview flow that is exactly contract-shaped (start → turns → done+feedback) … State = in-memory Map tonight behind the SessionStore interface … Write scripts/judge-sim.ts, scripted full-interview test against any base URL asserting contract shapes every turn … Walk me through deploying to Vercel.
**Outcome:** Next.js 15.5.23 scaffold (`create-next-app@15`, merged without touching provided docs/data); `lib/types.ts`, `lib/store/session.ts` (SessionStore interface + in-memory impl), `lib/engine/canned.ts` (8 questions across 8 curriculum days), `app/api/interview/route.ts` with defensive paths (400 JSON on malformed body, 200 in-character recovery on unknown session, outer catch, never 5xx), `app/api/health/route.ts`; `scripts/judge-sim.ts` (health probe, full CAND-001 interview with mixed-quality scripted answers, shape assertions every turn, feedback validation, defensive-path checks). Deployed to https://viva-bay.vercel.app, judge-sim 77/77 green against production. Commit: `progress1`.
**Steering notes:** Pinned `create-next-app@15` rather than latest (no new-major risk mid-hackathon) and stripped `--turbopack` from `next build` (beta) so Vercel builds stay on the stable path. Diagnosed a dev-server "hang" as my own tooling mistake (stdout piped to a dead process) instead of letting the agent rewrite working endpoint code. Enforced my git policy: the agent prepares changes; I review, commit, and push myself. Production judge-sim exposed real in-memory session loss across serverless instances (interview stretched to the 14-question ceiling via recovery restarts) → promoted Upstash Redis wiring to first task tomorrow morning.

### 2. Redis session store + the full interview engine (pulled forward from Saturday)
**When:** Fri 7 Aug, ~10:30 PM-11:00 PM IST
**Tool:** Claude Code (Fable 5)
**Goal:** Close the serverless state-loss risk with Upstash Redis, then build the entire interview engine, deterministic policy brain, Gemini adapter, planner, turn pipeline, feedback generator, so the only key-dependent step left is live testing.
**Prompt (representative):**
> Continue. (× several, the agent worked through the Redis wiring, verified current Gemini model names and the @google/genai SDK surface against ai.google.dev and the installed package types before writing the adapter, then built the engine per TRD §4-§5.)
**Outcome:** `lib/store/session.ts` gains RedisSessionStore (Upstash, 48h TTL, `UPSTASH_*`/`KV_*` env names, in-memory fallback), after I provisioned Upstash via Vercel Marketplace and pushed, prod judge-sim went from a 14-question limp (state loss) to a clean 8-question run, `/api/health` reports `store:"redis"`. Engine: `lib/engine/policy.ts` (topic selection from missions/signals, guardrails: coverage floor, wrap window 10-12/cap 14, no-3-consecutive, dont-know kindness, earned escalation, pre-call directives, confidence EMA) with 25 vitest tests incl. a full offline interview simulation; `lib/llm/gemini.ts` (verified models `gemini-3.5-flash` → `gemini-3.1-flash-lite`, JSON mode via responseJsonSchema + zod, backoff, timeout, fallback chain); prompts in `lib/llm/prompts/`; `planner/turn/feedback` engine modules, every stage has a deterministic fallback, proven by judge-sim 69/69 offline on the engine-wired route. CAND-004's opener now cites "5 attempts on Day 8" with zero LLM calls.
**Steering notes:** Made the agent verify Gemini model names + SDK surface from the installed package's type definitions, not doc summaries (the docs page showed a different, newer API family, `interactions`, that the installed SDK treats as a separate subsystem). Chose to wire the engine into the contract route tonight because the offline fallback path is test-proven, meaning tomorrow's key drop is config, not code. Thinking budget deliberately left at model default until measurable with a real key.

### 3. Live LLM bring-up: debugging, latency tuning, first real interviews
**When:** Fri 7 Aug, ~11:25 PM-11:50 PM IST
**Tool:** Claude Code (Fable 5) + Gemini API (live)
**Goal:** With the real GEMINI_API_KEY in place: get live adaptive interviews working end to end, measure and fix latency, validate the full contract against the live engine.
**Prompt (representative):**
> I have added the Gemini API key in Vercel also and in our local code. [+ claimed the Breeth code, asked what to do with it]
**Outcome:** First live run returned only backstop replies, the agent isolated it by testing layers separately (raw SDK: fine; production schemas through the adapter: fine) and found the real cause: unfilled `.env.example` placeholder Upstash creds in `.env.local` made the store target a non-existent host, and the route's judge-protection catch masked it. Fixed with a placeholder guard in `lib/store/session.ts`. Then measured `thinkingBudget` on gemini-3.5-flash (0 → ~2s/turn, default → ~6s, same quality) and made 0 the adapter default. Fixed opener prose (second-person reasonDetail rule in the planner prompt). Live results: adaptive follow-ups that quote the candidate and escalate to HNSW internals, kind dont-know pivots, judge-sim 53/53 in 44s against the live engine, and a 12-question live report whose gaps[] even flagged the test script's canned-answer mismatches as "prepared answers". Diagnostic scripts kept in `scripts/{gemini,engine}-smoke.ts`, `scripts/thinking-budget-test.ts`. Breeth: claimed key turned out to still be a placeholder in `.env.local` (write test → 401); after the real `ck_live_…` key went in, the full round-trip was verified, POST /v1/episodes (200, entities+edges extracted) then POST /v1/search reading the fact back after the ~15s async pipeline. The dashboard's "test write before building" requirement is done; API surface documented for tomorrow's memory feature.
**Steering notes:** Refused to guess at the silent failure, forced layer-by-layer isolation instead of code churn, which exposed a config issue rather than a code bug. Latency decision made on measurement, not guesswork (3× win from thinking budget 0 with no observable quality loss on this task shape). All debugging done with API keys masked from output.

### 4. Breeth long-term memory: the re-interview continuity moment (pulled forward from Saturday night)
**When:** Fri 7 Aug ~11:55 PM, Sat 8 Aug ~12:20 AM IST
**Tool:** Claude Code (Fable 5) + Breeth API (live) + Gemini API (live)
**Goal:** Cross-session candidate memory (TRD §6): write an interview summary to Breeth on wrap, recall it on the next interview of the same candidate, and open with continuity.
**Prompt (representative):**
> I have added the Breeth API key… changed BREETH_ENABLED to true… added both to Vercel.
**Outcome:** `lib/store/breeth.ts`, feature-flagged, fail-silent MemoryStore over the verified API (`POST /v1/episodes`, `POST /v1/search`, per-candidate `group_id`); recall on the start request (4s budget) feeding `priorMemories` into planner/turn/feedback prompts + a continuity line in the opener; memory write via Next 15 `after()` once the response is sent. 6 new vitest tests pin the no-op behavior when disabled/misconfigured (31 total). Verified live end-to-end through the route: wrap → `[breeth] memory written (200)` → re-interview start recalls 3 facts → "I also remember our previous conversation, I'll be checking how far you've come since."
**Steering notes:** Two real integration bugs found by testing rather than assuming: (1) Breeth's synchronous entity extraction can exceed 4s, so writes needed their own 45s budget separate from the recall path; (2) async-mode episode writes can lag indefinitely before becoming searchable, switched to blocking writes (`?wait_seconds=30`), free because they run in `after()` post-response. Also fixed a prompt-compliance bug where the LLM echoed the opener's sentence stem into reasonDetail, corrected in the prompt AND defensively stripped in code.

### 5. The interface: design system, roster, Interviewer Mind panel, evidence report
**When:** Sat 8 Aug, ~10:20 AM to 11:45 AM IST
**Tool:** Claude Code (Fable 5) with the impeccable, frontend-design, apple-design, ui-ux-pro-max and shadcn-ui skills, plus Playwright for visual review
**Goal:** Build the entire judge-facing interface: candidate picker, live interview with the Interviewer Mind panel, evidence-linked report, and a contract playground. It had to look deliberately designed rather than AI generated.
**Prompt (representative):**
> For the UI part, use all the skills /impeccable /apple-design /frontend-design /ui-ux-pro-max /shadcn-ui and gsap also, make the ui beautiful, it should not look like ai slop, maybe add some 3js animations etc.
> [later] make sure there should not be any m , n dashes anywhere
**Outcome:** A committed visual direction ("the examiner's desk at 9pm") captured in PRODUCT.md and DESIGN.md: ink-black ground, the interviewer's questions set in Newsreader serif, UI chrome in IBM Plex Sans, data in Plex Mono, with two semantic brand colours (green quill for strength and coverage, brass lamp for attention and gaps). The signature is **the Ledger**: each candidate's 31 days drawn as examiner's tally marks, one stroke per attempt, hollow box for skipped, brass rule for never passed, reused at three scales including a react-three-fiber version (**the Spine**) that re-inks as you move between candidates. Shipped `app/page.tsx` (roster list, not a card grid), `app/interview/[sessionId]`, `app/report/[sessionId]`, `app/api-docs`, `GET /api/session/[id]` for the panel, and eight new components. Full loop verified in the browser: CAND-004's opener cites 5 attempts on Day 8, the follow-up quotes the candidate's own sentence, coverage and confidence update live, and every report strength and gap opens to the verbatim quote plus curriculum day.
**Steering notes:** I rejected the obvious look up front. The frontend-design skill names "near-black plus one bright acid green accent" as a saturated AI default, so the green was kept muted, a second brass role was added, and the text was given warm paper tone so the page reads as ink on shadow rather than terminal. Anti-references were written into PRODUCT.md as hard bans (generic AI SaaS, ChatGPT clone, hacker terminal, corporate HR tech). Mid-session I banned em and en dashes everywhere; the agent's first bulk-rewrite script also stripped trailing commas and broke 38 files, so it backed the damage up, restored from the last commit, and redid the pass with a rule that only ever touches dash characters. The ban is now enforced in three places: the prompt templates, a `noDashes` sanitiser at the LLM boundary in `lib/text.ts` with its own tests, and the repo copy itself. 38 tests green, judge-sim 61/61, production build clean.

### 6. Judge proofing: README, accessibility audit, and hostile input hardening
**When:** Sat 8 Aug, ~11:30 AM to 12:00 PM IST
**Tool:** Claude Code (Fable 5) with the ui-ux-pro-max skill, Playwright for verification
**Goal:** Verify the deployed UI, write the judge facing README, audit accessibility, and prove the endpoint survives whatever a judge types into it.
**Prompt (representative):**
> continue
**Outcome:** Production verified live with the new interface, judge-sim 61/61 against https://viva-bay.vercel.app. Wrote README.md: the thirty second proof with real CAND-004 transcript excerpts, the three screenshots, a mermaid architecture diagram, the "never 500" degradation table, and the local run instructions. Ran the ui-ux-pro-max checklist as an audit against the real code and fixed five genuine findings: touch targets under 44px on the small text links and buttons, buttons defaulting to the arrow cursor, a missing h1 on the interview page for screen readers, inputs under 16px causing iOS to zoom on focus, and a forced line break making the mobile hero ragged. Confirmed zero horizontal overflow at 390px. Added `scripts/garbage-sim.ts` covering 27 hostile inputs (malformed and truncated JSON, candidate objects full of junk, empty and emoji only answers, a 12,000 character essay, path traversal in the sessionId, and a prompt injection); all 27 return non-5xx usable JSON.
**Steering notes:** The ui-ux-pro-max skill is written for React Native, so rather than running its design system generator I applied its priority 1 to 3 checklist as a manual audit of the real code, which is where the five findings came from. The prompt injection test was worth more than its pass or fail: the endpoint returned 200, but reading the actual reply showed the interviewer refused in character ("I am here to evaluate your technical engineering skills, not to play word games") and returned to the question. Reading that same output also caught a real quality bug, the model attributing fine-tuning to Day 11 when Day 11 is RAG End-to-End, so curriculum day titles are now injected into the turn prompt as ground truth with an explicit instruction never to invent what a day covered.

### 7. The spoken examiner: optional ElevenLabs voice
**When:** Sat 8 Aug, ~11:55 AM to 12:35 PM IST
**Tool:** Claude Code (Fable 5)
**Goal:** Let Viva conduct the interview aloud, since viva voce literally means an examination by live voice, without putting the graded submission at risk.
**Prompt (representative):**
> can we somehow implement 11abs, it will make it more unique
**Outcome:** `lib/voice.ts` plus `app/api/voice/route.ts`, a server side proxy so the ElevenLabs key never reaches the browser, using the verified `POST /v1/text-to-speech/{voice_id}` endpoint with `eleven_flash_v2_5`. Client hooks in `components/use-voice.ts`: the examiner speaks each new question, and the candidate can answer aloud through the browser's own speech recognition, which costs nothing. A "read aloud" toggle appears in the interview header only when a key is configured, and an "answer aloud" mic button appears only where the browser supports it. 8 new tests (46 total) pin that voice stays invisible when unconfigured and that an utterance can never exceed the character cap.
**Steering notes:** I flagged before building that HACKATHON.md scopes voice out of PS2, and chose the shape that carries no risk rather than skipping the idea: off by default, hidden entirely without a key, and completely separate from the contract endpoint, so the graded product is unchanged. Three constraints drove the design. The free tier is 10,000 characters per month, roughly two interviews, so replies are capped at 700 characters, cached per question, and voice never defaults to on. Every failure path (no key, spent quota, upstream 429) returns 204 so the interface falls quiet instead of erroring. And browser autoplay policy blocks the opening question on a fresh load, so a "tap to hear" control appears rather than the audio failing silently. Speaking is also driven by an effect rather than the fetch callback, because voice availability resolves asynchronously and the opening question would otherwise be skipped.

### 8. The spoken viva: streaming ElevenLabs voice and hands-free mode
**When:** Sat 8 Aug, ~1:00 PM to 1:30 PM IST
**Tool:** Claude Code (Fable 5)
**Goal:** Turn the optional voice prototype into the real thing. A viva voce is an oral examination, so Viva should conduct one: ask aloud, listen, and continue without the candidate touching the keyboard.
**Prompt (representative):**
> I have around 1 lakh credit left on my Eleven Labs account, I want to use it here also, so implement Eleven Lab properly so that my project gets more unique.
**Outcome:** Rebuilt around streaming. `POST /api/voice` registers a line and returns a short id, `GET /api/voice/[id]` pipes the ElevenLabs stream straight into an `<audio>` element so playback starts while generation is still running, instead of waiting for a whole synthesis round trip. Utterance ids live in Redis with a 15 minute TTL because on serverless the register and the stream can land on different instances. Voice is now on whenever a key is present, the picker is populated from the account's own `/v1/voices` at runtime, and hands-free mode chains the loop: speak, then open the microphone only after playback resolves, then auto-submit after three seconds of silence. 51 tests total, production build clean, and the unconfigured path still reports disabled and returns 204 everywhere.
**Steering notes:** The earlier version was built defensively around a 10,000 character free tier, capping utterances at 700 characters and defaulting to off. With real credits available those constraints were wrong, so the cap became a 1,800 character runaway guard rather than a budget and the default flipped to on. Three ordering bugs were designed out rather than discovered later: the microphone must not open until playback actually resolves or the recogniser transcribes the examiner's own question into the answer; `speak()` therefore returns a promise that settles on end, error, or interrupt; and typing must cancel the silence countdown so auto-submit can never fire underneath someone still composing. The requested voice id is pattern checked before being forwarded upstream, so a crafted request cannot use this route to reach arbitrary ElevenLabs endpoints.

### 9. Identity, landing page, and making the wait look like work
**When:** Sat 8 Aug, ~1:35 PM to 2:40 PM IST
**Tool:** Claude Code (Fable 5), Playwright for verification
**Goal:** Dress rehearsals against production, then a logo and favicon, real loading states, and turn the single roster page into an actual landing page.
**Prompt (representative):**
> Add some loading, like a skeleton loading. The favicon: build this thing's logo nicely, and the favicon will be the same. Build this thing's landing page.
> [later] When I am clicking on one interview it is stuck for 3 to 4 seconds... when the judges see it they will think it is not working and will go back.
**Outcome:** `scripts/rehearse.ts` runs a full interview against any deployment and prints it the way a judge reads it; all three rehearsals passed on production (CAND-001, CAND-004, and a pasted Product Manager). The logo is the product's own notation, an examiner's tally on a ruled line, shared by `app/icon.svg` and all three page headers. `components/planning-state.tsx` covers the wait before the first question, appearing at 0ms on click and naming each stage as it happens, with the tally mark drawing itself instead of a generic spinner. The landing page gained five sections built from real interview output rather than marketing copy, and README screenshots were retaken to match.
**Steering notes:** The first CAND-001 rehearsal scored nearly every answer as evasive, which looked like a model failure and was actually my harness: it fired a fixed answer list in order, so a question about persistent volume claims got answered with a line about Docker packaging. The model was right and the test was wrong, so answers are now selected by matching the question. The second run then proved the adaptive path properly: strong at L1 escalated to L2, an admitted gap dropped back to L1, and the verify-strength probe fired at L3 on the day she passed first try. Separately I had built skeletons for the wrong moment, route transitions, when the real delay is the planner's model call before question one; the fix had to start on the click itself, before navigation resolves, or the judge sees a dead page.

### 10. Diagnosing the real slowness, and scroll choreography for the landing
**When:** Sat 8 Aug, ~3:00 PM to 3:35 PM IST
**Tool:** Claude Code (Fable 5), Playwright for verification
**Goal:** The interview took 3 to 4 seconds to appear after a click, which reads as broken to a judge. Find the actual cause, then give the landing page real motion.
**Prompt (representative):**
> when I am clicking on one interview or candidate, it is taking too much time to load all the things. Fix it. After that, polish. I don't see a proper landing page right now. [with motionsites.ai and a prompt collection repo as references]
**Outcome:** The cause was not rendering. Measurement showed the start request taking 7.8s, made of two things: `gemini-3.5-flash` was returning HTTP 429 with "limit: 20", and the adapter was retrying the exhausted model twice with backoff before falling through, then Breeth recall ran sequentially before the planner. Added a quota circuit breaker in `lib/llm/gemini.ts` that reads the retry hint out of the 429 and skips that model until it expires, widened the chain to three models, and made recall run in parallel with the planner. Start latency went from 7.8s to about 3.0s, and `/api/health` now reports per model cooldowns so an exhausted key is visible rather than guessed at. Landing motion added in `components/scroll-motion.tsx` and `components/scroll-ledger.tsx`: a scroll progress hairline, staggered reveals, magnetic CTAs, and a pinned section where a candidate's 31 days are marked one day at a time as you scroll, with the day title and note tracking the scrub.
**Steering notes:** I pointed at the reference sites for the landing, and the agent flagged that their house style (glassmorphism, particle fields, gradient heroes) is the exact aesthetic I had already banned, so we took the motion craft and kept the examiner identity. Two of its own measurements turned out to be wrong and were caught by re-measuring rather than shipped: the first read blamed a deprecated latency parameter for a 3s delay that was actually a cold start, and a non-monotonic scrub reading (23, 15, 31, 21) looked like a broken animation but was an invalid measurement, since pinning inserts a spacer that moves the coordinates it had computed beforehand. Re-measuring in document coordinates showed a clean 1, 4, 9, 14, 20, 25, 30, 31 progression. A 65px horizontal overflow on mobile was likewise a stale ScrollTrigger measurement from resizing without a reload, and a clean load showed zero.

### 11. Live Steer, answer telemetry, and replaying the reasoning
**When:** Sat 8 Aug, ~4:05 PM to 5:05 PM IST
**Tool:** Claude Code (Fable 5), Playwright for verification
**Goal:** With a day left, add the things that make Viva unmistakable rather than polishing what already works.
**Prompt (representative):**
> Let's add more things to make the project more unique. Plan and think of some new things we can do to make it out of the box, unique from all the projects to stand out from them.
**Outcome:** Three features. **Live Steer**: the Mind panel becomes a control surface, so an observer can press harder, ease off, move on, wrap, or jump to a curriculum day mid-interview; it lives on its own `POST /api/session/[id]/steer` route so the graded contract endpoint never changes shape, and the rationale records the full chain of custody. **Answer telemetry**: each answer records whether it was typed, spoken, or pasted, and how long it took, surfaced inline in the transcript as observation rather than accusation. **Reasoning replay**: the report rebuilds the live panel state at every question, so coverage filling and confidence moving can be scrubbed after the fact, replayed from recorded evaluations rather than regenerated by a model. 56 tests, judge-sim and garbage-sim both green, build clean.
**Steering notes:** I asked for ideas and picked three. The agent argued for making steering a preference rather than an override, and that turned out to be the most interesting part of the feature: a `wrap` steer at question two is politely refused by the guardrails, and the panel shows the model's reasoning, the observer's request, and the policy override side by side, which demonstrates the contract minimums are real rather than advertised. It also insisted the steer route stay separate from `POST /api/interview` so a judge's automated test can never see a field it did not send. Four separate edits were mangled by the shell expanding template literals inside heredocs, each caught by type checking rather than shipped; the agent switched to direct file edits for anything containing them.

### 12. Production dress rehearsal, and fixing what Viva actually remembers
**When:** Sat 8 Aug, ~7:45 PM to 8:15 PM IST
**Tool:** Claude Code (Fable 5), Playwright for verification
**Goal:** Verify the deployed build end to end with every feature live, then fix anything the rehearsal exposed.
**Prompt (representative):**
> continue
**Outcome:** Full rehearsal against https://viva-bay.vercel.app: judge-sim 69/69, garbage-sim 27/27, and Live Steer verified on the deployed build (a wrap steer at question two refused, a day steer landing on Day 28, press harder raising difficulty, each with the chain of custody in the rationale). The report page on production showed 12 replay steps, 12 telemetry lines, and 3 steer marks against 3 policy overrides. Breeth continuity confirmed live: a second interview of CAND-004 opened with "I also remember our previous conversation" and recalled 6 facts. Those facts were the problem, so `lib/store/breeth.ts` was changed on both sides: memories are now written as sentences about the candidate rather than recommendations naming curriculum days, and recall asks what the person got right and wrong instead of asking for "recommendations".
**Steering notes:** The rehearsal's value was catching a quality bug that every green test had missed. Continuity worked, but what it remembered was the syllabus: "Day 10 focuses on Retrieval and Matching Engine". An A/B of the old and new queries against identical stored data isolated the cause precisely, 8 facts with 3 syllabus-style versus 12 facts with none, which proved the retrieval query was at fault rather than the stored data. Two of my own diagnoses along the way were wrong and corrected by measuring: a recall timeout looked like the longer query being slower, but both queries measured about 2.4s and the real cause was a cold cache on a brand new group, which costs nothing because a first interview has no memories to find anyway.
