---
description: Grade a page against DESIGN.md (add "fix" to apply the safe fixes)
argument-hint: "[url or html file] [fix]"
---

Run taste-lint on: $ARGUMENTS

Follow the taste-lint skill:

1. Find the DESIGN.md (project root first). If there isn't one, stop and say so; offer to draft one from the current styles, but don't grade against a file you just invented.
2. Work out the page: the URL or HTML file in the arguments, or the running dev server. If nothing is running, ask which page to check.
3. Run the measure pass:
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/measure.js" --design DESIGN.md --url <url> --out taste-lint`
   (use `--html <file>` for a static file). If Playwright is missing, run `npm install && npx playwright install chromium` inside `${CLAUDE_PLUGIN_ROOT}` first.
4. Do the look pass from the skill, then present the report card: the score, the category bars, the top problems with their fixes, and the path to `taste-lint/report.html`.
5. If the arguments include "fix": apply only the fixes that are a straight token swap (a literal value replaced by the suggested token) in the source files, list anything that needs judgment, and re-run the measure pass to show the new score.
