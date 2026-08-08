# Product

## Register

product

## Users

**Hackathon judges (primary, next 7 days).** Two independent judges scoring on originality, polish, and AI steering. They arrive at the live URL late at night, having already opened dozens of submissions. They will run automated contract tests against `POST /api/interview`, then interview manually as CAND-001 (star performer), CAND-004 (struggler, MBA, skipped Docker), and likely a pasted custom candidate. Their job: decide within seconds whether this is another thin LLM wrapper or something built with intent.

**Cohort learners (real users).** Graduates of the ABTalks 31 day AI cohort practising technical interviews grounded in what they actually studied and where they actually struggled. They arrive slightly nervous, on a laptop, often at night. They want to be tested honestly and told the truth kindly.

**The ABTalks team.** Assessing cohort outcomes at scale. The report doubles as a learning gap analysis.

## Product Purpose

Viva conducts a realistic, adaptive technical interview personalised to a candidate's actual 31 day learning journey. It reads their mission history (attempts, skips, first try passes), plans which topics to probe and why, adapts every question to the previous answer, **shows its reasoning live** in an Interviewer Mind panel, and delivers feedback where every claimed strength or gap quotes the candidate's own words and names the curriculum day to revisit.

Success: a judge interviewing as CAND-004 hears an opening question that could only have been asked to CAND-004, and screenshots the Mind panel.

## Brand Personality

**Considered, rigorous, humane.** Viva is the examiner who has read your work before you sat down. It speaks in complete, unhurried sentences: never chirpy, never robotic, never cruel. It is warm about people and exacting about ideas. It will praise a good answer in four words and then ask a harder one.

The interface embodies the *viva voce*, the oral examination every engineering student knows. The examiner's questions carry a human voice (serif, considered, generous line height). The examiner's notes carry machine precision (sans, tabular, hairline ruled). That contrast between spoken warmth and analytical rigour **is** the product. It is not decoration.

Emotional goal: the candidate should feel *seen*, with the unnerving and motivating sensation that this examiner did their homework.

## Anti-references

Hard bans, confirmed by the builder:

- **Generic AI SaaS.** No purple or indigo gradients, no glassmorphism cards, no rounded-2xl everything, no gradient text, no "AI powered" sparkle copy. This is the default every competing submission will ship.
- **ChatGPT clone.** No plain message bubbles in a centre column with an avatar circle. That silhouette makes Viva look like the thin wrapper it is specifically not.
- **Hacker terminal.** No green on black, no ASCII art, no monospace everywhere, no fake typing cursors. This is the second order cliche for "AI tool that isn't SaaS purple", avoided as deliberately as the first.
- **Corporate HR tech.** No handshake stock photography, no navy and teal, no LinkedIn blue trust signals, no pill badges.

## House rules

- **No em dashes and no en dashes anywhere.** Not in UI copy, not in docs, not in model output. Use a comma, a colon, parentheses, or a second sentence. This is enforced in the prompt templates and again in code at the LLM boundary (`lib/text.ts`), because the dash is one of the loudest "written by AI" tells.

## Design Principles

1. **Show the homework.** Every screen proves Viva read the candidate's journey. Personalisation is never claimed in copy, it is visible in the content: a day number, an attempt count, a quoted sentence.
2. **The reasoning is the product.** The Interviewer Mind panel is a first class surface, not a debug drawer. Machine reasoning rendered with the same care as the conversation.
3. **Two voices, one page.** Spoken warmth (serif, generous) against analytical precision (sans, tabular, hairline). Never blur them, the tension is the identity.
4. **Evidence or silence.** No claim about a candidate appears without their own words attached. Strengths and gaps are clickable back to the quote that proves them.
5. **Earned familiarity in the task, one committed moment at the door.** The interview and report obey product register discipline: standard affordances, 150-250ms motion, state conveying only. The landing page is permitted a single showcase moment (the journey Spine), because it is the judge's first five seconds.

## Accessibility & Inclusion

- **WCAG 2.2 AA.** Body text at least 4.5:1, large text at least 3:1, verified. That includes placeholders and muted metadata, which is where dark UIs usually fail.
- **Reduced motion is a first class path**, not a stripped one. `prefers-reduced-motion: reduce` replaces every GSAP entrance and the WebGL Spine rotation with an immediate, complete static state. Nothing becomes invisible or unusable.
- **Never colour alone.** Answer quality, coverage, and confidence always carry a text or shape signal alongside their colour.
- **Keyboard complete.** The full interview is operable without a mouse, with visible focus rings on every interactive element, and the Mind panel is reachable and announced.
- **Usable at 390px.** Judges may demo on a phone, so the Mind panel becomes a collapsible sheet rather than disappearing.
