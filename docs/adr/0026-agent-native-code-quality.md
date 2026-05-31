# ADR-0026: Agent-Native Code Quality Approach

**Status:** Accepted  
**Date:** 2026-05-31  
**Amended:** 2026-05-31 — CodeScene reclassified from passive dashboard to mandatory agent-run quality gate following installation of CodeScene MCP Server v1.2.2.

## Context

The project was using SonarCloud (cloud) and CodeScene (cloud) as quality gates alongside local ESLint. This created three problems:

1. **Visibility gap:** SonarCloud and CodeScene flagged issues the agent couldn't see, requiring the human to manually push back on PRs rather than the agent catching problems before committing.
2. **Duplicate sources of truth:** SonarCloud ran its own rule configuration independently of local ESLint (which also included `eslint-plugin-sonarjs`). The same rules could be configured differently in the two tools, causing confusion about which to trust.
3. **Reactive not proactive:** The feedback loop was write code → CI flags → human reviews dashboard → human pushes back on PR → agent fixes. This is designed for a human developer who maintains a persistent mental model of the codebase over time — not for an agent that reads the codebase fresh each session.

## Decision

Replace reactive external monitoring with agent-native pre-flight checks:

1. **Single source of truth:** Local ESLint (`eslint-plugin-sonarjs` + `typescript-eslint`) is the blocking CI gate. SonarCloud has been removed. CodeScene is integrated via MCP as a mandatory agent-run quality gate: `pre_commit_code_health_safeguard` runs before every commit; `analyze_change_set` runs before every PR. If either reports a regression, the agent refactors until Code Health is restored — work is not marked done with a failing safeguard. Target Code Health is 10.0.

2. **Pre-flight, not post-hoc:** Before modifying any existing file, the agent runs `bun run lint` on it and reports existing violations. If a file already has complexity errors, the first task is a refactor, not a new feature.

3. **Pre-commit build check:** The agent runs `bun run lint && bun run build` in both apps before every commit — turning CI from the first gate into the last gate.

4. **Rule consolidation:** Web ESLint rules tightened to match the signal SonarCloud was providing:
   - `sonarjs/no-nested-conditional` → `error`
   - `sonarjs/no-nested-template-literals` → `error`
   - `sonarjs/no-nested-functions`, `sonarjs/deprecation`, `sonarjs/function-return-type`, `sonarjs/no-unenclosed-multiline-block` → `off` (noise in React context)
   - `sonarjs/cognitive-complexity` remains at `warn, 10` until the 7 existing violations in `ChecklistSection`, `usePortalTheme`, `TemplateEditPage`, `PortalContractPage`, `PortalMusicPage`, `PortalPage` are cleaned up, at which point it moves to `error` and `--max-warnings 0` is added to the web lint script.

## Trade-offs

**Lost:** Dashboard-style trend visibility from SonarCloud (now removed). Mitigated by the pre-flight lint check and Code Health MCP tools — the agent sees both the lint state and structural health of any file before touching it.

**Gained:** Single coherent signal the agent can run and act on. No friction from tool disagreement. Proactive rather than reactive. Code Health MCP tools (`code_health_review`, `pre_commit_code_health_safeguard`, `analyze_change_set`) provide structural feedback — cognitive complexity trends, hotspot exposure — that ESLint cannot express, and a 10.0 target sets a concrete quality bar beyond lint.

## Rationale

Traditional quality tools assume a developer who lacks persistent codebase memory session-to-session but builds cumulative awareness over weeks. The agent has the opposite profile: no persistent memory across sessions, but full read access within a session. A dashboard the agent can't query is useless; a tool the agent calls before writing is immediate and actionable. The CodeScene MCP server resolves the original visibility gap — Code Health is now agent-queryable within a session, making it compatible with the agent-native approach rather than in tension with it.
