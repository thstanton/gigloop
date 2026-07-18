# Report template

Write to `docs/uat/reports/<YYYY-MM-DD>-<flow>.md`. Screenshots are referenced
by relative path into `assets/` (gitignored) — embed nothing.

---

# UAT report — <flow> (<date>)

**Environment:** <local dev | preprod> · **Branch/commit:** `<git rev-parse --short HEAD>`
**Personas:** <name (device, archetype)> × N · **Task script:** `docs/uat/tasks/<file>.md`

## Executive summary

Three or four sentences, worst finding first: did the personas get through the
flow, where did they break, what single change would help most. This is the
part the human reads first — write it for them.

## Convergence matrix

| # | Finding (one line) | Severity | <Persona A> | <Persona B> | <Persona C> |
|---|--------------------|----------|-------------|-------------|-------------|
| 1 | …                  | Blocker  | step 04     | —           | step 07     |

A cell is the journal step where that persona hit the finding, or `—`. Use
`step NN (soft)` for a hit the persona noticed without logging friction.

## Findings

Ordered by severity tier, then convergence within the tier. Max ~7. Each:

### <N>. <Severity> — <one-line title>
- **What happened:** two or three sentences, grounded in the journals.
- **Evidence:** `<persona>/journal.md` step NN · `<persona>/step-NN.png`
- **Personas hit:** <names> — one clause on *why* each hit or sailed past it
  (this is the triangulation insight: "only the skimmer hit it because the fix
  is in helper text" is more useful than the finding itself).

## Candidate improvements

Ranked list (severity × convergence), each one line, phrased as an **option**
("Consider…", "One fix would be…") — the human decides. No issues are filed.

## Persona journeys (appendix)

Per persona, a short narrative paragraph **in their voice** summarising the
run — the colour lives here and only here. Link to the full journal. Never
quote persona-voice material in the findings or improvements sections.

## Skill calibration (footer, only when needed)

Out-of-character persona behaviour, task-script ambiguities, or harness
problems observed this run — feedback for tuning `docs/uat/`, not app findings.
