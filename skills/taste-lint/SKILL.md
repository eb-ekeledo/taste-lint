---
name: taste-lint
description: Grades a rendered UI against the project's DESIGN.md and reports drift as a scored report card with fixes. Use when someone asks whether a page follows the design system or DESIGN.md, to check for design drift, off-brand colours, inconsistent spacing or type, or to lint a page's design before shipping. Not for writing a DESIGN.md or reviewing code logic.
---

# taste-lint

DESIGN.md tells agents how a product should look. Its own linter checks that the file is valid. Nothing checked that the shipped UI actually follows it. This does.

## Two passes

**1. Measure (deterministic, 100% of the score).** `scripts/measure.js` opens the page in a real browser, reads the computed style of every visible element and compares it with the DESIGN.md tokens:

| Category | Rule | Weight |
| --- | --- | --- |
| Colour | Every solid text, background and border colour within Delta E 2.3 of a `colors` token | 25 |
| Type | Font family, size and weight from `typography` | 25 |
| Spacing | Padding, vertical margins and gaps on the `spacing` scale | 20 |
| Radius | Corners from `rounded` (pills allowed when a `full` token exists) | 10 |
| Contrast | Text meets WCAG AA against its background | 20 |

Each distinct problem costs 12 points in its category. The same page always gets the same score.

```bash
node scripts/measure.js --design DESIGN.md --url http://localhost:3000 --out taste-lint
node scripts/measure.js --design DESIGN.md --html page.html --out taste-lint --threshold 80
```

It writes `report.html` (the report card with evidence crops), `report.png`, and `report.json`. Exit code 1 means below the threshold.

**2. Look (your judgment, reported separately).** Open `taste-lint/report.png` and a screenshot of the page, then read the prose sections of DESIGN.md (overview, do and don't, layout, shapes). Score these 1 to 5, one line of evidence each:

- **Hierarchy:** is the one most important thing obvious?
- **Rules in prose:** does the page break any written rule? (for example "accent only for the primary action")
- **Density and rhythm:** consistent with the system's described feel?
- **Tone:** does it feel like the overview says it should?

Never fold the look scores into the measured score. Show them as a separate row so the number stays reproducible.

## Presenting results

1. Lead with the score and the verdict: "73, below 80. 11 problems, 3 of them in type."
2. Show the top problems as a short table: what, where, fix.
3. Point to `taste-lint/report.html` for the evidence crops.
4. Then the look pass, four lines.

## Fixing

- Only auto-apply straight token swaps: a literal value replaced by the suggested token (`#3B82F6` → `var(--colors-accent)` or the project's equivalent). Use the project's existing way of referencing tokens.
- Anything that needs judgment (a font swap that changes layout, a contrast fix that changes the brand feel) gets listed, not applied.
- Re-run the measure pass after fixing and show the new score.

## Notes

- Semi-transparent colours are skipped; they are usually overlays and shadows.
- Horizontal margins are skipped because `auto` centring would always look off-scale.
- If DESIGN.md has no `spacing` or `rounded` tokens, those categories are skipped, not failed.
