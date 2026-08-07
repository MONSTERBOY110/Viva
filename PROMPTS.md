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
