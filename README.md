# CySA+ Practice Hub

A static web app for practicing CompTIA CySA+ style questions. Open
`index.html` (or serve the folder); no build step, no backend.

**Educational use only.** Not affiliated with, endorsed by, or sponsored by
CompTIA. CompTIA and CySA+ are trademarks of CompTIA, Inc.

## What's here

- `index.html` — dashboard: Quick Quiz tiles and the Full Custom Quiz, plus a
  Resume banner for a paused quiz.
- `custom.html` — pick 45–245 questions and choose which topics to include.
- `quiz.html` — the quiz runner and results screen (score out of 100,
  per-topic breakdown, every question reviewed with a "why" for each option,
  and "Retake the ones I missed").
- `assets/data.js` — the question bank (`CYSA_QUESTIONS`) and topic lists
  (`CYSA_OBJECTIVES`, `CYSA_SUB_OBJECTIVES`).
- `assets/app.js`, `assets/styles.css` — shared logic and styling.
- `CySA*_Day*.html`, `CySA_Final_Review.html` — the original standalone quiz
  files the bank was built from. Kept for reference.

## Features

- Questions and answer order are re-randomized every attempt.
- Pause a quiz at any time; it's saved in your browser.
- Every answer choice, right or wrong, shows an explanation.
- After any quiz, retake just the questions you missed, round after round,
  until every one is right.

## Checks: `verify/` (need Playwright; not needed to run the site)

- `node verify/retake.mjs` drives "Retake the ones I missed" end to end,
  including a 45-question custom quiz, with contrast measured on painted
  pixels. `--plant` runs 8 plants, each one a planted bug the check must
  catch.
