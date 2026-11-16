# Changelog

## 2.0.0 (2026-11-16)

- **Line height and letter spacing** are now checked against `typography`, wherever the token at that size defines them.
- **`--widths 375,1280`**: phone and desktop in one run. Problems that only happen at one width are labelled with it. Evidence crops come from the widest width that shows the problem.
- **Ignore list**: anything inside `[data-taste-lint-ignore]` is skipped; `--ignore "<selector>"` for widgets you can't mark.
- **Token references** like `"{colors.accent}"` are resolved, including chains. Broken ones are printed and listed under `designWarnings`.
- Report card shows up to 24 problems (was 12), and the report no longer records your machine's file paths.
- Examples: drifted page gains letter-spacing, line-height and phone-only spacing drift, plus an ignored chat widget. 13 planted problems, all found.

## 0.1.0 (2026-11-12)

- First release: measure pass (colour, type, spacing, radius, contrast), report card with evidence crops and fixes, look-pass rubric, /taste-lint command with safe fixes, clean and drifted examples, checks.
