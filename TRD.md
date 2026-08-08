# TRD, Viva: Technical Requirements & Architecture

> Companion to PRD.md. This is the build spec for the implementing agent.
> **Golden rule: the judge-facing API contract in §3 is sacred. Never change its shape.**

---

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | One repo, one deploy: UI + API routes. Fast to extend live (Live Steer finale). |
| Styling | **Tailwind CSS** (+ shadcn/ui if useful) | Speed + polish. Dark mode default (judge demos at night). |
| LLM | **Gemini free tier** via `@google/genai` SDK | Zero cost through the judging window. Structured JSON output mode. |
| Session state | **Upstash Redis** (Vercel Marketplace, free tier) | Serverless functions are stateless; judge auto-tests must hit consistent state. |
| Long-term memory | **Breeth Pro** (sponsor; free for participants) | Cross-session candidate memory. Behind an interface, feature-flagged. |
| Hosting | **Vercel** | Instant deploys, always-on (no cold-sleep like Render free). |
| Repo | GitHub, public, **created after kickoff (Fri 7 Aug, 8 PM IST)** | Authenticity gate. |

**Env vars:** `GEMINI_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `BREETH_API_KEY` (optional), `BREETH_ENABLED=true|false`.

**Verify at build time (do not trust this doc's memory):** current Gemini model names + free-tier limits (aim: `gemini-2.5-flash` class primary, `-lite` class fallback), `@google/genai` API surface, Breeth docs at https://docs.thebreeth.com.

## 2. Repository layout

```
viva/
├── app/
│   ├── page.tsx                  # Landing: candidate picker
│   ├── interview/[sessionId]/    # Chat + Interviewer Brain panel
│   ├── report/[sessionId]/       # Evidence-linked feedback report
│   ├── api-docs/                 # Contract playground for judges
│   └── api/
│       ├── interview/route.ts    # THE CONTRACT ENDPOINT (POST)
│       ├── session/[id]/route.ts # Internal: brain-panel state (GET)
│       └── health/route.ts       # GET → {ok:true} for auto-verifier
├── lib/
│   ├── engine/
│   │   ├── planner.ts            # candidate profile → InterviewPlan
│   │   ├── turn.ts               # one interview turn (evaluate → decide → ask)
│   │   ├── feedback.ts           # final report generation
│   │   └── policy.ts             # pure-TS decision rules (testable, no LLM)
│   ├── llm/
│   │   ├── gemini.ts             # provider adapter w/ fallback chain + backoff
│   │   └── schemas.ts            # zod schemas for every structured LLM output
│   ├── store/
│   │   ├── session.ts            # SessionStore interface + Redis + in-memory impls
│   │   └── breeth.ts             # MemoryStore impl (feature-flagged)
│   └── data/
│       ├── curriculum.json       # provided by organizers (bundled)
│       └── candidates.json       # provided by organizers (bundled)
├── scripts/
│   └── judge-sim.ts              # scripted full-interview contract test vs any URL
├── PROMPTS.md                    # AI-usage log (eligibility gate, append all weekend)
├── HACKATHON.md · PRD.md · TRD.md · EXECUTION-PLAN.md · CLAUDE.md
└── README.md                     # judge-facing: what, why, architecture, how to run
```

## 3. The judge-facing API contract (verbatim from technical-spec.md)

`POST /api/interview`, no auth. State keyed by `sessionId`.

**Start** (first request for a sessionId):
```json
{ "sessionId": "abc-123", "candidate": { ...candidate object from candidates.json } }
→ { "reply": "Welcome…", "done": false }
```

**Turn:**
```json
{ "sessionId": "abc-123", "message": "candidate's answer" }
→ { "reply": "next question", "done": false }
```

**End** (when the engine wraps):
```json
→ { "reply": "Interview completed…", "done": true,
    "feedback": { "summary": "…", "strengths": [], "gaps": [], "next": [] } }
```

**Hard rules:**
- `feedback` fields: `summary: string`, `strengths/gaps/next: string[]`, concise, actionable points.
- Minimums: ≥8 questions, ≥4 distinct curriculum days, contextual follow-ups, state maintained per `sessionId`.
- **Extra response fields are additive-only** (e.g., a `_brain` object for our UI is acceptable, extra JSON keys break nothing, but never remove/rename contract fields).
- Defensive paths (never 5xx): unknown `sessionId` without candidate → 200 with a polite recovery reply that restarts; malformed body → 400 with a JSON error message; LLM total failure → canned graceful interviewer line.

## 4. Data models

```ts
type InterviewPlan = {
  candidateId: string;
  topics: PlannedTopic[];          // 5-6, spanning ≥4 curriculum days
  personaNotes: string;            // e.g. "senior DevOps, respect experience, push depth"
};
type PlannedTopic = {
  day: number;                     // curriculum day
  module: string;
  reason: "struggled" | "skipped" | "verify-strength" | "core";
  reasonDetail: string;            // "4 attempts on Day 12"
  startDifficulty: 1 | 2 | 3;      // L1 recall · L2 application · L3 depth
};
type Turn = {
  q: string; a?: string;
  day: number; difficulty: 1|2|3;
  eval?: { score: number;          // 0-1
           classification: "strong"|"partial"|"weak"|"evasive"|"dont-know";
           evidence: string };     // short quote from the answer
  rationale: string;               // brain panel: why this question
};
type SessionState = {
  sessionId: string; candidate: Candidate; plan: InterviewPlan;
  turns: Turn[]; coverage: number[];           // days touched
  confidence: Record<string, number>;          // module → 0-1
  phase: "active" | "wrapping" | "done";
  startedAt: string;
};
```

## 5. The engine

### 5.1 Planner (runs once, on the start request)
Pure analysis of `candidate.missions` + `candidate.signals`, then **one** LLM call to draft the plan:
- high `attempts` → `struggled` topic, start L1-L2
- `skipped: true` → `skipped` topic, gentle L1 probe
- `attempts: 1` + high `missionsFirstTry` → `verify-strength`, start L2-L3
- fill remaining slots with `core` days (RAG, agents, MCP, the cohort's spine)
Deterministic pre-processing in `policy.ts` picks the topic set; the LLM writes `reasonDetail` + `personaNotes`. Plan is stored in session state and shown in the UI.

### 5.2 Turn pipeline, ONE structured LLM call per turn
Input: system prompt (interviewer persona + policy rules) + plan + compact rolling state (confidence, coverage, last 4-6 turns verbatim, older turns summarized) + candidate's latest message.

Output (zod-validated, JSON mode):
```json
{
  "evaluation": { "score": 0.4, "classification": "partial",
                  "evidence": "said embeddings 'match words', missed semantic similarity" },
  "action": "drill" | "escalate" | "switch" | "wrap",
  "nextDay": 12, "nextDifficulty": 2,
  "rationale": "Weak on fundamentals candidate claims to know; one more probe before moving on",
  "reply": "You mentioned embeddings 'match words', but then how does…"
}
```
`policy.ts` enforces guardrails ON TOP of the LLM's choice (deterministic + unit-testable):
- coverage floor: if turns ≥ 6 and days-covered < 4 → force `switch`
- wrap window: wrap at 10-12 questions, hard cap 14
- never 3 consecutive questions on one day; `dont-know` → mark gap, drop difficulty or switch
- question must reference candidate's words when classification ≠ strong (the follow-up requirement)

### 5.3 Feedback (on wrap)
One LLM call over full turn history → contract `feedback` object **plus** internal `evidenceMap` (report UI links each strength/gap → turn quote → curriculum day). `next[]` items name specific days: *"Revisit Day 20 (Conversation Memory), rebuild the summarizer without a framework."*

### 5.4 LLM adapter (`lib/llm/gemini.ts`)
- JSON output mode + zod parse; on parse failure → 1 repair retry
- Fallback chain: primary flash → flash-lite → static graceful reply (never throw to route)
- 429/backoff with jitter; per-session serialization (no parallel calls per session)
- Every prompt template lives in code under `lib/llm/prompts/`, makes PROMPTS.md verifiable against source

## 6. Memory

- **SessionStore (Upstash Redis):** `get/set(sessionId, SessionState)`, TTL 48h, JSON serialized. In-memory fallback for local dev. This is what keeps the judge's automated multi-turn test coherent on serverless.
- **Breeth (long-term, feature-flagged):** on interview completion, write a candidate memory summary (gaps, strengths, date). On planner start, query Breeth for prior memories of that candidate → if found, plan opens with continuity ("re-probe last time's gaps first") and the report includes an improvement delta. If `BREETH_ENABLED=false` or API errors → skip silently; product must be whole without it.

## 7. UI requirements

- **Landing:** candidate cards (avatar initials, role, XP years, signal chips: `31/31 first-try`, `skipped Docker`); CTA "Start interview". Custom-JSON paste box behind a toggle.
- **Interview:** chat pane + **Interviewer Brain** panel (desktop: right side; mobile: collapsible sheet). Brain shows: current rationale, plan progress (topics ticked), coverage meter `4/6 days`, per-module confidence bars animating on update, next-move hint. Data source: `GET /api/session/[id]` fetched after each reply, keep the contract endpoint's response pristine (an additive `_brain` field is the documented fallback only if the extra fetch causes UI jank).
- **Report:** summary hero, strengths/gaps as evidence-linked cards (click → quoted answer), `next[]` as a checklist mapped to curriculum days. Print-friendly.
- Dark mode default, clean typography, 60fps, judges score polish. Mobile-usable (ABTalks audience is mobile-first) though judges will likely demo on desktop.

## 8. Testing & judge-proofing

- `scripts/judge-sim.ts <base-url>`: runs a full interview as a scripted candidate (mix of strong/weak/evasive/"I don't know" answers) → asserts contract shapes every turn, `done` arrives in 8-14 questions, ≥4 days covered, feedback shape valid. **Run against production before every submission save.**
- Unit tests for `policy.ts` (pure functions, coverage floor, wrap window, difficulty ladder).
- Manual dress rehearsal Sunday: interview as CAND-001 (strong senior), CAND-004 (struggler), one custom candidate; garbage-input pass (empty msg, 5-word answers, pasted essay, off-topic).

## 9. Performance & quota budget

- ~12-16 Gemini calls per interview (1 plan + ~12 turns + 1 feedback + retries).
- Target < 4s per turn p95 (single LLM call, no chains). Streaming optional; skip if it threatens stability.
- Free-tier daily quota comfortably covers judging (~10-20 interviews/day); if RPM is the binding constraint, per-session serialization + backoff absorbs bursts. Verify current limits at build time; if tight, request a second key (teammate account) for the fallback model only.

## 10. Deployment & ops

1. Hour 1: scaffold → push → Vercel import → deploy (dummy contract responses OK) → live URL exists from night one.
2. Every merge to `main` auto-deploys. Keep `main` always-green; feature branches optional given solo speed.
3. `GET /api/health` → `{ok:true, version}`, their auto-verifier needs a working application response.
4. Before each submission save: `judge-sim` vs prod + manual smoke on phone.

## 11. Live Steer Challenge prep (top-6 finale, 20 min, unseen feature, live)

The architecture is the preparation: policy in pure TS, one engine entry point, typed state, additive API. Likely asks (practice one on Sunday evening): interview timer/duration cap · difficulty selector · export report · multi-language question support · score normalization across candidates · "hiring recommendation" field in feedback.
