# HACKATHON.md, Rules digest (ABTalks Vibe Code Hackathon)

> Source: https://www.abtalks.in/hackathon/submission + /hackathon/dashboard (read 7 Aug 2026).
> Participant: **Subhojyoti Maity, SOLO**, Bengal Institute of Technology.

## Timeline (all IST)

| Event | When |
|---|---|
| Kickoff (clock started) | **Friday 7 Aug, 8:00 PM** |
| Midpoint check-in (optional, WhatsApp) | Saturday 8 Aug |
| **Submission deadline (repos locked)** | **Sunday 9 Aug, 8:00 PM** |
| Results | Friday 14 Aug |

**Our internal deadline: Sunday 6:30 PM IST.** The submission form allows re-saving until the deadline → save a working submission Saturday night, keep improving after.

## Problem statement chosen: PS2, The Interview Agent

Build an AI agent that conducts a realistic, multi-turn technical interview personalized to a candidate's journey through the 31-day AI Cohort.

**Minimum requirements (all mandatory):**
- Conversational technical interview
- ≥ 8 questions covering ≥ 4 different curriculum days
- Follow-up questions generated from previous responses
- Conversation context maintained throughout
- Structured feedback at the end
- Expose the HTTP endpoint defined in `technical-spec.md` (`POST /api/interview`)

**Provided resources (bundled in `lib/data/` and `docs/`):** `curriculum.json` (31 days, 8 modules), `candidates.json` (candidate profiles w/ missions, attempts, skips, signals), `technical-spec.md` (API contract).

**Out of scope (do not build):** voice, auth, persistent user accounts, long-term conversation history, mobile apps.

## The four evaluation stages

### Stage 1, Eligibility (automated, pass/fail, verified at submission AND re-checked after deadline)
- Repo publicly accessible, URL valid
- **Live Demo URL functional and returns a working application**
- AI Usage Log included and accessible
- Registered team, submitted before deadline

### Stage 2, Authenticity (automated + manual)
Disqualification triggers, avoid ALL of these:
- Repo created **before** kickoff (Fri 7 Aug 8 PM IST) → create fresh
- First commit already contains most of the project → start from scaffold, build in public
- Sparse history + one big final commit → **commit every 30-60 min with meaningful messages**
- AI Usage Log doesn't correspond to implemented features → PROMPTS.md entries must map to real commits/features
- Prompt history incomplete/generic/unrelated → log real prompts as you go, not retro-fabricated

### Stage 3, Judging (2 independent judges × 100 pts)
- Judges score separately; final = average; >15pt spread → third judge, median wins
- Dashboard states the criteria: **originality, polish, and how well you steered the AI**

### Stage 4, Live Steer Challenge (top 6)
- Live video call, screen shared throughout
- Same unseen feature request for all finalists; **20 minutes** to implement in your own repo using your hackathon AI tools
- Implication: keep the codebase modular, typed, always-green

## Submission form fields (per problem statement, we fill PS2's)

1. **Public GitHub repo link**, full source, public, cloneable
2. **Live URL**, Vercel deployment ("a README-only demo doesn't count")
3. **AI-usage log URL**, `https://github.com/<user>/<repo>/blob/main/PROMPTS.md`

## Sponsor perk

**Breeth Pro** free for participants (memory layer for AI agents + MCP server).
Claim: https://www.thebreeth.com/event/abtalks-vibe-code-hackathon-breeth-ai-memory · Docs: https://docs.thebreeth.com
Used structurally in Viva as cross-session candidate memory (see TRD §6).

## Contacts / links

- Submission page: https://www.abtalks.in/hackathon/submission
- Dashboard: https://www.abtalks.in/hackathon/dashboard
- Organizer email: team@abtalks.in
- WhatsApp group: linked from dashboard
