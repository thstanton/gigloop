---
name: uat
description: Persona-fleet UAT walkthrough of the running GigLoop app. Sends contrasting personas (docs/uat/personas/) through a pre-agreed task script via playwright-cli, each in a fresh executor sub-agent, then triangulates their journals into a prioritised Blocker/Major/Minor report with a convergence matrix. Use when the user asks for a UAT run, usability walkthrough, persona testing, or invokes /uat — typically after a feature or flow rework, before or alongside its PR.
---

# /uat — persona-fleet usability walkthrough

Produces a **report, never issues**. It is heuristic evaluation wearing personas —
an overview for the human to decide what to improve — not real user research.

## Inputs

1. **Task script** — a file in `docs/uat/tasks/*.md` (or draft one from the flow
   under test and confirm it with the user before running). Tasks are user
   *intents*, not UI steps.
2. **Personas** — default: every file in `docs/uat/personas/`. The user may name
   a subset.
3. **Environment** — local dev (`http://localhost:5173`, needs `bun run dev`
   running) or preprod (`https://preprod.gigloop.co.uk`). **Never prod.**
   Confirm the target app is reachable before spawning any executor.

## Orchestration (main session)

Run personas **serially** — one browser session, pristine state each:

1. Create the run directory: `docs/uat/reports/assets/<YYYY-MM-DD>-<flow>/<persona>/`.
2. For each persona, spawn one **executor sub-agent** (Agent tool,
   `general-purpose`). Build its prompt from
   [references/executor-prompt.md](references/executor-prompt.md), pasting in
   the full persona file, the full task script, env details, and the run dir.
3. **State reset between personas:**
   - First-run flows (onboarding): each executor signs up fresh — email
     `uat-<persona>-<yyyymmdd>+clerk_test@example.com`, Clerk dev-instance OTP
     `424242`. No reset needed. The executor prompt's standing
     "Known harness limitations" block covers the sign-up CAPTCHA and dev
     overlays — keep it in every executor prompt.
   - Established-user flows: executors share the seeded user; re-seed between
     personas (`bun --filter @gigloop/api run seed`, local dev only — confirm
     with the user before re-seeding anything else).
4. After each executor returns, skim its journal for a wedged browser session
   (`playwright-cli -s=uat close` cleans up) before starting the next.

## Analyst pass (main session, after all journals are in)

1. Read every journal. Extract findings; **dedupe across personas** — the same
   obstacle hit by two personas is one finding with two hits.
2. Severity comes from task outcome, never adjectives:
   - **Blocker** — persona could not complete the task (includes "gave up").
   - **Major** — completed, but via a workaround or a wrong mental model.
   - **Minor** — hesitation, mislabel, polish.
3. Convergence (how many personas hit it) ranks findings **within** a severity
   tier — it never promotes/demotes across tiers. A single-persona Blocker is
   still a Blocker.
4. Drop any finding you cannot anchor to a journal step + screenshot. Cap the
   report at ~7 findings; a clean run with zero Blockers is a legitimate short
   report — do not pad.
5. Write the report to `docs/uat/reports/<YYYY-MM-DD>-<flow>.md` following
   [references/report-template.md](references/report-template.md). Screenshots
   stay in the assets dir (gitignored), referenced by relative path.
6. Final message to the user: the executive summary + report path. Do not file
   issues; the "Candidate improvements" section is options for the human.
7. **Only if the human later asks** to track findings: file them as issues
   using the triage-label vocabulary (`docs/agents/triage-labels.md`), dedupe
   against `gh issue list` first, split any finding whose halves deserve
   different labels, then stamp the issue numbers back into the report.

## Guardrails

- **Never run against prod.** Env allowlist is local dev and preprod only.
- Executors have hard caps (in the executor prompt): 15 actions per task, 2×
  patience budget overall. A cap hit is recorded as "gave up" — a Blocker —
  never pushed through.
- Executors must not delete or edit seeded records unless the task script says
  so and a re-seed is planned.
- Persona files are the skill's tuning surface. If a run exposes a persona
  behaving out of character (e.g. the "skimmer" reading helper text), note it
  in the report's "Skill calibration" footer so the persona file gets fixed.
