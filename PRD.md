# PRD, Viva: The AI Interview Agent

> **Hackathon:** ABTalks Vibe Code Hackathon · Problem Statement 2 ("The Interview Agent")
> **Team:** Subhojyoti Maity (SOLO) · Bengal Institute of Technology
> **Deadline:** Sunday, 9 Aug 2026 · 8:00 PM IST (submit by 6:30 PM, see EXECUTION-PLAN.md)
> **Tagline:** *The interviewer that already read your homework.*

---

## 1. One-liner

Viva is an AI technical interviewer for the ABTalks 31-day AI Cohort that **plans a personalized interview from each candidate's actual learning journey**, adapts every question to their answers in real time, **shows its reasoning live** in an "Interviewer Brain" panel, and delivers evidence-linked feedback where every claimed strength or gap quotes the candidate's own words.

## 2. Why this wins

The judging criteria are **originality, polish, and how well the AI was steered** (2 judges × 100 pts, published rubric). Most PS2 submissions will be a thin LLM wrapper asking 8 generic questions in a loop. Viva is differentiated on every axis judges can observe:

| Judge experience | Thin wrapper | Viva |
|---|---|---|
| First question | "Tell me about RAG" | "You needed 4 attempts to pass Prompt Engineering on Day 12, walk me through why your first few-shot approach might have failed" |
| Follow-ups | Next canned question | Quotes the candidate's previous answer, drills or escalates based on answer quality |
| Transparency | Black box | Live Brain panel: *why this question, coverage so far, per-skill confidence* |
| Feedback | Generic paragraphs | Every strength/gap cites a quoted answer + the curriculum day to revisit |
| Re-interview | Amnesia | Remembers the last interview via Breeth long-term memory: "Last time you struggled with chunking, has that improved?" |

Strategic tailwinds:
- **The judges are the customer.** ABTalks runs this exact cohort; Viva is a product they want on their own roadmap.
- **Objectively testable.** Judges will interview as candidates from `candidates.json`, personalization is visible within 30 seconds.
- **Sponsor integration that is structural**, not decorative (Breeth = cross-session interview memory).
- **Live Steer ready.** Clean modular engine → an unseen feature can be added in 20 minutes on camera.

## 3. Users

1. **Hackathon judges** (primary for the next 7 days), will hit the live URL, run automated contract tests against `POST /api/interview`, and interview manually as several candidates.
2. **Cohort learners**, practice technical interviews grounded in what they actually studied and where they actually struggled.
3. **ABTalks team**, assess cohort outcomes at scale; the final report doubles as a learning-gap analysis.

## 4. Core user journey

1. **Pick a candidate**, landing page shows candidate cards from the provided `candidates.json` (name, role, signals: commit days, first-try rate, skipped topics). Judge picks one (or pastes custom candidate JSON).
2. **Pre-interview plan**, Viva analyzes the journey and shows the interview plan forming (topics chosen + why). ~2 seconds of visible intelligence before question 1.
3. **The interview**, multi-turn chat (8-12 questions across ≥4 curriculum days, per the minimum requirements). Right-side **Interviewer Brain** panel updates live:
   - current probe rationale ("4 attempts on Day 12 → testing prompting fundamentals")
   - coverage meter (days covered / planned)
   - per-module skill confidence bars
   - next planned move
4. **The report**, structured feedback (contract shape: `summary`, `strengths[]`, `gaps[]`, `next[]`), every item evidence-linked to quoted answers and mapped to specific curriculum days. Shareable/printable.
5. **Re-interview (the Breeth moment)**, interviewing the same candidate again opens with continuity: prior gaps get re-probed first, improvement is acknowledged in the report.

## 5. Features & priorities

### P0, must ship (eligibility + minimum requirements)
- [ ] `POST /api/interview` implementing the exact contract in `technical-spec.md` (start / turn / end with `done` + `feedback`)
- [ ] Interview engine: ≥8 questions, ≥4 curriculum days, context maintained across turns, adaptive follow-ups
- [ ] Planner: interview plan derived from candidate missions + signals (attempts, skips, first-try rate)
- [ ] Per-answer evaluation → next-question policy (drill / escalate / switch / wrap)
- [ ] Structured final feedback (contract shape), evidence-linked
- [ ] Chat UI (usable at mobile width, dark mode default)
- [ ] Live deploy on Vercel + `/api/health`; never returns 5xx to the judge (LLM fallback chain)
- [ ] PROMPTS.md AI-usage log (eligibility gate, see HACKATHON.md)

### P1, the differentiators (target: all of these)
- [ ] **Interviewer Brain panel** (live rationale, coverage, confidence radar/bars)
- [ ] Candidate-picker landing page with journey visualizations
- [ ] Evidence chips in the report (click a gap → see the quoted answer that proves it)
- [ ] Breeth long-term memory: cross-session candidate continuity
- [ ] API playground page (`/api-docs`): interactive proof of contract compliance for judges
- [ ] Interviewer voice/persona: professional, warm, rigorous, never robotic ("Good. Now suppose your examples contradict the system prompt, which wins?")

### P2, if time remains (polish tier)
- [ ] Anti-vagueness probing: detect memorized/hand-wavy answers → force an applied scenario
- [ ] "I don't know" grace: drop difficulty, note the gap, move on kindly
- [ ] Difficulty read-out per question (L1 recall / L2 application / L3 depth)
- [ ] Report export (copy as Markdown / print stylesheet)
- [ ] Session replay page for judges to review a past interview

### Explicitly out of scope (per problem statement)
Voice interaction · user auth · persistent user accounts · long-term conversation history (beyond the Breeth continuity feature) · mobile apps.

## 6. Success criteria

1. **Stage 1 gate passes:** repo public, live URL returns a working app, PROMPTS.md accessible, verified before Saturday night, re-verified before final save.
2. **Contract test:** a scripted judge-simulation (start → 10 turns → done+feedback) passes against the *production* URL.
3. **The 30-second test:** a judge interviewing as CAND-004 (Business Analyst, 5 attempts on MCP, skipped Docker) hears a first question that could only have been asked to CAND-004.
4. **The wow moment:** the Brain panel makes at least one judge screenshot it.
5. **Authenticity:** 25+ meaningful commits spread across both days; PROMPTS.md maps to features.

## 7. Risks

| Risk | Mitigation |
|---|---|
| Gemini free-tier rate limits during judging | Single structured LLM call per turn; model fallback chain (flash → flash-lite); exponential backoff; friendly retry message, never a crash |
| Serverless state loss between turns | Session state in Redis (Upstash via Vercel Marketplace), not process memory |
| Breeth API unknown/flaky | Behind a `MemoryStore` interface; feature-flagged; app fully functional without it |
| Judge sends garbage / empty / off-topic input | Graceful handling paths tested in the dress rehearsal script |
| Deadline-hour panic | Submit the form Saturday with a working build; re-save improved versions (edits allowed until deadline) |

## 8. Naming

Working name **Viva** (viva voce, the oral exam every Indian engineering student knows). Rename is a find-replace; do not burn time on it.
