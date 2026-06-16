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
