# Design

The visual system for Viva. Every colour, type, and motion decision in the codebase derives from this file.

## Theme

**The examiner's desk at 9pm.** Green ink drying on answer scripts, a brass lamp, everything else in shadow. The page is the shadow, and the paper is the *text*, not the background. That inversion is deliberate and it is what keeps this out of the cream background AI default. Dark is not chosen because tools look cool dark: judges open this at night, candidates rehearse at night, and the conversation needs to be the only lit thing on the screen.

**Colour strategy: Restrained.** Neutral chroma-0 greys carry the architecture. Two brand colours carry meaning and nothing else. Combined coverage of green plus brass stays under about 10% of any screen.

## Colour

OKLCH only. Never hex.

| Token | Value | Job |
|---|---|---|
| `--ground` | `oklch(0.085 0 0)` | Page ground. Pure neutral, no hue tint, ever. |
| `--panel` | `oklch(0.125 0 0)` | The Mind panel, report cards, roster rows. |
| `--raised` | `oklch(0.165 0 0)` | Inputs, hover, the answer composer. |
| `--rule` | `oklch(0.265 0 0)` | Rules, borders, meter tracks. |
| `--rule-soft` | `oklch(0.19 0 0)` | Interior dividers. |
| `--ink` | `oklch(0.94 0.010 85)` | Body text, answer script paper. Warmth lives here, not in the ground. 15.4:1 |
| `--dim` | `oklch(0.645 0.008 85)` | Secondary text, metadata, placeholders. 6.6:1 |
| `--faint` | `oklch(0.46 0.006 85)` | Disabled and decorative only. Never meaningful text. |
| `--quill` | `oklch(0.66 0.142 150)` | **The examiner's ink.** Strength, coverage, active state, links, focus. 7.0:1 |
| `--quill-bright` | `oklch(0.87 0.140 150)` | The single filled CTA, a stamp. Carries `--ground` text at 12.9:1. |
| `--quill-dim` | `oklch(0.40 0.075 150)` | Filled meter portions behind text, inactive marks. |
| `--lamp` | `oklch(0.86 0.112 76)` | **The lamp.** Attention: current probe, gaps, policy overrides. 12.4:1 |
| `--lamp-dim` | `oklch(0.52 0.070 76)` | Brass borders and low emphasis marks. |

Rules:

- Green and brass are **semantic, never decorative**. Green means marked, strong, covered. Brass means attention, gap, override.
- Green is never used as a mid luminance filled surface behind text. Filled treatments use `--quill-bright` with `--ground` text.
- Colour never carries meaning alone. Every state also has a label or a shape (see Components).
- Green and brass converge under deuteranopia, which is why the label rule is absolute.

## Typography

Three roles on three real contrast axes. Never two similar sans faces.

| Role | Family | Where |
|---|---|---|
| **Voice** | Newsreader (serif, optical sizing) | What the interviewer *says*. Questions, report summary, hero. |
| **Chrome** | IBM Plex Sans | All UI: labels, buttons, nav, the candidate's own answers. |
| **Data** | IBM Plex Mono | Scores, day numbers, session ids, meters, tabular values. |

Fixed rem scale (product register, no fluid type inside the app. The landing hero is the one exception).

```
data      0.75rem  / 1.4   tracking +0.02em
ui-sm     0.8125rem/ 1.45
ui        0.875rem / 1.5
body      0.9375rem/ 1.6
voice     1.25rem  / 1.65  Newsreader 400   the interviewer's questions
voice-lg  1.5rem   / 1.55  Newsreader 400   at 1024px and above
display   2.5rem   / 1.05  Newsreader 500, tracking -0.02em
```

- Tracking is size specific: negative on display (-0.02em), zero on body, slightly positive on 12px labels.
- `text-wrap: balance` on headings, `pretty` on prose. Voice text capped at 62ch.
- Uppercase micro labels are allowed **only** inside the Mind panel and report where they are genuine field labels for data. They are never section eyebrows.

## Punctuation

**No em dashes and no en dashes anywhere**, including model generated interview text. Use a comma, a colon, parentheses, or a second sentence. Enforced in the prompt templates and again at the LLM boundary by `noDashes` in `lib/text.ts`.

## Layout

- **Landing:** the signature Spine, then a roster **list**, not a card grid. Cards are the lazy answer and identical card grids are banned.
- **Interview:** two columns at 1024px and above, conversation (1fr, max 62ch) plus Mind panel (380px, sticky). Below 1024px the Mind panel becomes a bottom sheet with a persistent summary bar so the reasoning never fully disappears.
- **Report:** single column, 68ch, print friendly.
- Radius: `2px` on everything. This is paper and rules, not pills. The one exception is the round day marks in the Ledger.
- z-scale: `--z-sticky: 10; --z-sheet: 40; --z-overlay: 50; --z-tooltip: 60`. Never arbitrary values.

## The signature

**The Ledger.** Each candidate's 31 days rendered in the examiner's own vernacular, as tally marks. One column per curriculum day: a single green stroke for a first try pass, stacked tally strokes for each additional attempt, a hollow outline for a skipped day, a brass underscore for a failed one. It is not a chart of the data, it *is* the data, in the notation an examiner would actually use. It appears at three scales: compact in each roster row, full width for the selected candidate, and as the coverage track inside the Mind panel.

**The Spine** (one WebGL moment, landing only). The Ledger wrapped into space: the same notation curved across 31 days, with ruled columns so the structure stays legible on sparse days, re-inked as you move between candidates. Structured and data driven, never a particle field. `prefers-reduced-motion` holds it at a fixed angle, and no WebGL falls back to the full width 2D Ledger.

## Motion

GSAP for choreography, CSS for state. Every animation conveys state, none decorates.

- **State transitions 150-250ms**, `power3.out` or `expo.out`. No bounce, no elastic, no orchestrated page load sequences inside the app.
- **Interruptible:** anything the user can retrigger animates from its current on screen value, never from the target.
- **The one exception** is the landing entrance, where the Ledger strokes draw on in sequence (600ms or less in total). A page whose thesis is "we already read this" earns a moment of writing.
- Meters and confidence bars animate their fill, never layout properties.
- New Mind panel rationale enters as a 200ms crossfade with a 6px rise. The previous rationale demotes into a history list rather than vanishing.
- **Reduced motion:** every entrance becomes an instant complete state, the Spine stops rotating, meters jump to value. Nothing is hidden behind a transition, content is visible by default and animation only enhances it.

## Components

Every interactive element ships default, hover, focus-visible, active, disabled, and where relevant loading and error. Focus is a 2px `--quill` ring at 2px offset, never removed.

- **Answer composer:** a ruled writing surface, not a chat input. Submit on Ctrl or Cmd plus Enter as well as the button.
- **Conversation:** the interviewer's question is set as page prose in Voice, with no bubble and no avatar. The candidate's answer is an indented block in Chrome with a left hairline, the way an answer sits under a question on a script. This silhouette is the deliberate opposite of a chat transcript.
- **Evidence chip:** a gap or strength followed by a quote mark. Activating it reveals the candidate's verbatim sentence and the curriculum day. Never a tooltip, because evidence is content.
- **Meters:** `--rule` track, `--quill` fill, always with a mono numeric label beside it.
- **Empty and loading:** skeletons that match the final layout, and empty states that teach ("Pick a candidate, Viva reads their 31 days before the first question"). Never a centred spinner.
