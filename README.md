# CySA+ Practice Hub

A static web app for practicing CompTIA CySA+ style questions. Open
`index.html` (or serve the folder); no build step, no backend.

**Educational use only.** Not affiliated with, endorsed by, or sponsored by
CompTIA. CompTIA and CySA+ are trademarks of CompTIA, Inc.

## Topics

The quiz's 15 topics come from the instructor's objectives list for CySA+
(V4), numbered in its order and labelled in its wording. The instructor's
CS0-004 score report confirms that 13 of these numbers match CompTIA's own
(1.1–1.4, 2.1–2.4, 3.1–3.3, 4.1–4.2); 1.5 and 1.6 are unconfirmed. A
verbatim copy of the list is in `verify/objectives-cysa-2026-09-30.md`.

Every question was read and filed under the topic it actually tests
(30 September 2026). The goal is at least 20 questions per topic; topics
still short are being filled.

## What's here

- `index.html` — dashboard: Quick Quiz tiles and the Full Custom Quiz, plus a
  Resume banner for a paused quiz.
- `custom.html` — pick 45–245 questions and choose which topics to include.
- `quiz.html` — the quiz runner and results screen (score out of 100,
  per-topic breakdown, every question reviewed with a "why" for each option,
  and "Retake the ones I missed").
- `assets/data.js` — the question bank (`CYSA_QUESTIONS`, 500 questions) and
  topic lists (`CYSA_OBJECTIVES`, `CYSA_SUB_OBJECTIVES`). Edit it directly.
  **Do not run `tools/tag-subobjectives.mjs`**: it re-tags every question
  with the old home-made topics and would undo the filing.
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

- `node verify/objectives.mjs` checks the topics against the list, that every
  question is filed and well formed with exactly one correct answer, 20+ per
  finished topic, and drives the custom quiz and results screen. `--plant`
  runs 18 plants.
- `node verify/retake.mjs` drives "Retake the ones I missed" end to end,
  including a 45-question custom quiz, with contrast measured on painted
  pixels. `--plant` runs 8 plants, each one a planted bug the check must
  catch.
