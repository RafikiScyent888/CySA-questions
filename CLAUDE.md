# CySA+ quizzes — project context

Read with `/root/.claude/CLAUDE.md`, which sets the rules and wins over this
file: push to GitHub after each verified change, AAA contrast on painted
pixels, objectives from the owner's Google Doc, 20+ questions per topic. The
CySA+ objective notes are in `/root/.claude/cysa-v4-objectives.md`.

## What this is

A static CySA+ practice site. It is a different engine from the Network+ and
Security+ quiz sites, so their fixes don't port directly.
- `assets/data.js` holds `CYSA_QUESTIONS`: `{id: "q1", q, options:
  [{text, correct, why}], objective, objectiveName, sub, topic, source}`.
- The session is kept in localStorage under `cysa_quiz_session_v1`.
- GitHub Pages serves `main`.

## Retake (30 September 2026)

"Retake the N I missed" on the results screen:
- It builds a new session from the missed question ids, shuffled with fresh
  option order, and increments `round`.
- Every retake question shows a round banner, the results heading says which
  round it is, and a round with nothing missed says "Every one right".
- A retake round survives Pause and Resume.
- The button is `#0b3a82`, because white on the site's standard `#0d6efd`
  button is only 4.5:1.

## Known, not yet fixed

- **Contrast:** the standard `#0d6efd` buttons measure about 4.5:1, under the
  AAA floor for body text. The fix is a colour change, so it needs a preview
  for the owner first.
- **Footer:** it isn't the program's standard wording yet. It is waiting for
  the owner's go-ahead.
