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

**Never run `tools/tag-subobjectives.mjs`.** It rewrites every question's
topic back to the old 19 home-made labels.

## Topics (30 September 2026)

- **Source:** the 15 topics come from the owner's "All updated Objectives" doc
  (CySA+ V4), in its order and wording.
  - The owner's CS0-004 score report confirms 13 of the numbers match
    CompTIA's: 1.1–1.4, 2.1–2.4, 3.1–3.3, 4.1–4.2.
  - 1.5 and 1.6 are unconfirmed.
- **Filing:** all 500 questions were read and filed one by one. The owner saw
  the preview first and approved it: "I like CySA, push it."
- **Where old topics with no match in the doc went:**
  - Encryption, identity and cloud concepts went to 1.1, and their attacks
    to 1.2.
  - Weak-crypto and hardening fixes went to 2.3.
  - Pen testing: rules of engagement and scope went to 2.4, techniques to
    2.1, validation to 2.2, reports to 4.1.
  - Secure coding: naming the flaw went to 2.2, fixing it to 2.3.
  - Forensics went to 3.3 ("evidence handling").
  - Business continuity and disaster recovery:
    - Running a recovery went to 3.2.
    - BIA, RTO/RPO and supplier risk went to 2.4.
    - Crisis communication went to 4.2.
  - Risk, compliance and governance went to 2.4 ("controls, policies, and
    compliance practices"), which is why 2.4 is large.
- **The floor:** each short topic is topped up to 25.
  - Topics still short are listed in `PENDING` in `verify/objectives.mjs`.
  - Take a topic off that list in the same commit that fills it.
  - 30 Sept 2026: 96 new questions:
    - q501–q550: 3.1 Attack frameworks +25, 1.6 AI +25
    - q551–q596: 4.1 VM reporting +21, 4.2 SecOps/IR reporting +15,
      2.2 Analyze output +10
  - Every topic now has 20+ (596 questions), and `PENDING` is empty.
- **New questions:**
  - Ids continue from q501.
  - The `source` field begins "written 30 Sept 2026 for doc topic".
  - Exactly one option is correct, and every option has a "why".
  - Wrong options are near misses.
  - Lengths are balanced, so the right answer isn't usually the longest.

## Retake (30 September 2026)

"Retake the N I missed" on the results screen:
- It builds a new session from the missed question ids, shuffled with fresh
  option order, and increments `round`.
- Every retake question shows a round banner, the results heading says which
  round it is, and a round with nothing missed says "Every one right".
- A retake round survives Pause and Resume.
- The button is `#0b3a82`, because white on the site's standard `#0d6efd`
  button is only 4.5:1.

## Contrast (fixed 30 September 2026)

Every student-facing screen meets AAA on painted pixels. The owner approved
the before/after preview: "I like all of the changes in all of the quizzes".
- The approved colours are in a block marked "AAA contrast" (at the end of `assets/styles.css`).
- Colour changes stay in the royal palette, with no new hues.
- Disabled buttons are no longer faded out. They're solid silver with a dashed
  border and readable text.
- `node verify/contrast.mjs` drives every screen (dashboard, setup, question
  before and after answering, results, paused-quiz banner) and fails on
  anything under 7:1 (4.5:1 for large text). `--plant` puts back the old
  sky-blue buttons and must fail.

Run it after any colour or layout change.

## Known, not yet fixed

- **Footer:** it isn't the program's standard wording yet. It is waiting for
  the owner's go-ahead.
