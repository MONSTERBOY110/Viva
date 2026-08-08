# EXECUTION-PLAN.md, the 48 hours, block by block

> Clock started Fri 7 Aug 8:00 PM IST. Deadline Sun 9 Aug 8:00 PM IST. Internal cutoff **Sun 6:30 PM**.
> Solo + Claude Code. Commit every 30-60 min. Append PROMPTS.md as you go.

## Friday night, Foundation (9:30 PM, 1:30 AM)

- [ ] Create **fresh public GitHub repo** (after kickoff, timestamp matters)
- [ ] Scaffold Next.js 15 + TS + Tailwind; commit scaffold as first commit (small, honest)
- [ ] Drop in docs (this folder) + `lib/data/{curriculum,candidates}.json` + `docs/technical-spec.md`
- [ ] `POST /api/interview` with hardcoded canned flow (contract-shaped start/turn/end) + `/api/health`
- [ ] Deploy to Vercel → **live URL exists tonight**
- [ ] Claim Breeth Pro + run one test write (dashboard said to do this before building)
- [ ] Set up Upstash Redis via Vercel Marketplace; wire SessionStore (in-memory fallback for dev)
- [ ] Start PROMPTS.md with tonight's sessions
- **Checkpoint:** contract endpoint answers a 3-turn canned conversation on production.

## Saturday morning, The engine (9 AM, 1 PM)

- [ ] Gemini adapter: JSON mode + zod schemas + fallback chain + backoff (TRD §5.4)
- [ ] Planner: candidate profile → InterviewPlan (deterministic topic pick + one LLM call)
- [ ] Turn pipeline: single structured call (evaluation + action + reply) with policy guardrails
- [ ] `scripts/judge-sim.ts`, scripted interview vs any URL; run it constantly
- **Checkpoint:** full 10-question adaptive interview via curl/judge-sim on production, ≥4 days covered, real follow-ups.

## Saturday afternoon, Feedback + UI core (2 PM, 7 PM)

- [ ] Feedback generator (contract shape + evidenceMap)
- [ ] Landing page: candidate cards from candidates.json (+ custom JSON toggle)
- [ ] Interview chat UI wired to the contract endpoint
- [ ] Basic report page
- **Checkpoint:** end-to-end in the browser: pick CAND-004 → interview → report.
- [ ] **SAVE THE SUBMISSION FORM NOW** (repo + live URL + PROMPTS.md URL). Eligibility locked in with 25h to spare. Keep re-saving after improvements.

## Saturday night, The differentiator (8 PM, 1 AM)

- [ ] **Interviewer Brain panel**: rationale feed, coverage meter, confidence bars, next-move hint
- [ ] Evidence chips on the report (gap → quoted answer → curriculum day)
- [ ] Breeth long-term memory: write on completion, read in planner, continuity line in opening + report delta
- **Checkpoint:** the Brain panel visibly updates as answers change quality (test: answer one question brilliantly, the next with "I don't know").

## Sunday morning, Polish (9 AM, 1 PM)

- [ ] Visual pass: dark mode, typography, motion, empty/loading states, 390px usability
- [ ] Persona/voice pass on all interviewer prompts (warm, rigorous, quotes the candidate)
- [ ] Garbage-input hardening (empty, one-word, essay-paste, off-topic, "end the interview")
- [ ] `/api-docs` playground page + README with screenshots & architecture diagram
- **Checkpoint:** judge-sim green on prod; phone demo feels good.

## Sunday afternoon, Dress rehearsal + ship (1 PM, 6:30 PM)

- [ ] Full rehearsals as CAND-001 (star), CAND-004 (struggler), one custom candidate
- [ ] Re-interview CAND-004 → verify Breeth continuity moment
- [ ] PROMPTS.md final review (complete, maps to commits); commit history sanity check
- [ ] Final deploy → judge-sim vs prod → smoke on phone
- [ ] **Re-save submission form** with final URLs. Screenshot the confirmation.
- [ ] 6:30 PM: STOP. Do not deploy after this unless something is on fire.

## Sunday evening, Live Steer insurance (optional, 7 PM+)

- [ ] 20-minute drill: pick one likely feature (timer, difficulty selector, export) and implement it against the clock in a branch. Delete or merge after, the practice is the point.

## Standing orders

- Every block ends with: commit + push + PROMPTS.md entry + (if user-visible) prod deploy check.
- If a block overruns badly: cut P2 first, then P1 items in reverse order. The P0 contract engine is untouchable.
- If Gemini rate-limits during dev: switch judge-sim to fewer runs, add the -lite fallback earlier.
