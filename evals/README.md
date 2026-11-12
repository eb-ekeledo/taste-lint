# Evals

| Layer | Question | How | Status |
| --- | --- | --- | --- |
| 1. Trigger | Does Claude load the skill at the right time? | `triggers.json`: 10 prompts that should load it, 10 that shouldn't. Target 9 of 10 each side. | Prompt set written, not yet scored |
| 2. Correctness | Does it find real drift without false alarms, and give the same answer twice? | `node scripts/check.js`: clean page scores 95+, drifted page has all 10 planted problems found with at most 1 other finding, two runs match, under 60 s. | Passing (10 of 10 found, 1 other, clean = 100) |
| 3. Better than nothing | Does a review with taste-lint catch more than Claude reviewing by eye? | 5 real pages with their DESIGN.md, reviewed with and without the plugin. Count true problems found and false alarms. Ship rule: with-plugin wins on 4 of 5. | Not yet run |

## Taste tests

- **Almost-right pairs:** pages that differ by one value (a 2px spacing slip, a near-miss grey). The measure pass must catch the slip in the drifted one and stay silent on the other.
- **Look pass:** the four 1 to 5 scores should agree with a designer's ranking of 5 pages at least 4 times out of 5.
