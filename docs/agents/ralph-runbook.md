# Ralph Runbook

Operational know-how accumulated across cold iterations. Injected into every prompt alongside `git log` and the issue corpus.

**Guardrails for adding entries:**
- Operational facts only — commands that actually work, pitfalls you hit, the right flag after running the wrong one.
- Brief: one entry ≈ one paragraph or a few bullets. No prose.
- Never duplicate what `CLAUDE.md` already states.
- Add via sub-agent at step 5 (after commit). The human prunes/promotes at PR review.

---

## GitHub auth in the sandbox

`gh auth status` always shows "not logged in" inside the sandbox — this is expected. The proxy injects credentials for git HTTPS operations **only when** the user has run:

```
sbx secret set <sandbox-name> github -t "$(gh auth token)"
```

Without this one-time setup, `git push` and `gh issue edit` will fail with 401/auth errors. Commits are still made locally; the human can push + open the PR by hand. Check `$SANDBOX_VM_ID` for the sandbox name.

## CI / scripts

Files in `scripts/` are in the `web` filter (the `scripts/**` glob). Changes there trigger the web test job (node `--test` runs) but do NOT trigger ESLint (the lint job only runs `cd apps/web && bun run lint`, not scripts). So removing a `.mjs` in `scripts/` will never surface an ESLint error — verify by running `node --test scripts/<file>.test.mjs` directly instead.

## Web tests (vitest)

The `@rolldown/binding-linux-arm64-gnu` native binding may be missing after a fresh install (only darwin-arm64 ships in the lockfile). Symptom: `vitest run` exits immediately with "Cannot find native binding." Fix: run `bun install` from the repo root — bun resolves the correct platform binding. Tests (`bun run test`) work after that.

## Shortcut-detector and deleted files

When `git rm` stages a deletion, the diff uses `+++ /dev/null` (not `+++ b/<path>`). The shortcut-detector previously misattributed the deleted file's removed assertions to the prior file in the diff, producing a false-positive net-loss violation. Fixed in scripts/shortcut-detector.mjs — now handles `+++ /dev/null` correctly.

## Pre-commit hook timing

The pre-commit hook in `apps/web` runs lint + shortcut-detector. ESLint over the web workspace takes 60-120 seconds. Use `run_in_background: true` for commits and wait for the completion notification; do NOT poll with repeated `git log` calls.

## Pre-existing test failures (as of 2026-06-20)

`bun run test` in `apps/web` shows 4 failed test files / 7 failed tests:
- `BookingDetailPage.stories.tsx` — story still references `'+ Add to series'` link which was removed in #528. Pre-existing, not introduced by Music atom slice.
- Several vitest pool timeout errors appear under resource pressure (environment timeouts, not test failures).
