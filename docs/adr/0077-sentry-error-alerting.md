# ADR-0077: Application error alerting — Sentry, captured at the existing exception filter, prod-only paging

- **Status:** Accepted
- **Date:** 2026-08-20
- **Grilled from:** #744 (Observability: alert on application errors in prod), grilled 2026-08-20
- **Related:** [ADR-0075](0075-one-environment-model.md) §4 (control plane — names this as the "errors and exceptions" pane), [ADR-0070](0070-issuing-is-repairable.md) (repairability is not a substitute for observability — this is the observability)

## Context

A first attempt to send email after migrating `RESEND_FROM` to the gigloop domain returned a 500. The actual cause was a Resend 403 — the domain was configured but a verification step was incomplete. Nothing surfaced this; it was found only by manually reading Railway logs. Any 5xx in prod today is invisible until a human happens to look, or a user reports it (`docs/environments.md` marks this line `⏳ #744`).

`apps/api/src/common/all-exceptions.filter.ts` already does the status-code triage this needs: any `HttpException` uses its own status; anything else (including the bare `Error` that `mail.service.ts:188` throws on a Resend rejection) becomes a hardcoded 500, logged as JSON to stdout and nowhere else. There are no custom exception subclasses anywhere in the API — every provider failure already free-falls to this same generic-500 branch.

## Decision

**Sentry** (`@sentry/nestjs` + `@sentry/react`), not a Railway log drain into Better Stack/Axiom. Nearly everything worth alerting on here is already a thrown exception; Sentry groups by fingerprint (one alert, not a flood) where a log drain would need "arbitrary log-string matching" configured by hand for every failure mode.

### Capture: an explicit call inside the existing filter, not `SentryGlobalFilter`

`SentryGlobalFilter` is designed to be the outermost filter in a chain of Nest filters. `AllExceptionsFilter` is registered directly on the Express instance via `app.useGlobalFilters()` in `main.ts`, not through the `APP_FILTER` provider token — stacking `SentryGlobalFilter` correctly against that is exactly the silent-misordering trap the originating issue warned about ("looks installed but reports nothing"). Instead, `AllExceptionsFilter.catch()` calls `Sentry.captureException(exception)` explicitly in the branch that already computes `status >= 500`. One line, impossible to silently misorder, trivially unit-testable.

No other code changes to error handling. `mail.service.ts:188` and every other provider-failure call site stay as bare `Error`s falling through to the generic 500 branch — they already satisfy "provider failures map to 5xx, never 4xx" today. Auditing every provider-dependent call site for a mismapped 4xx is unbounded, separate work; Sentry reporting is what makes such a mismap discoverable in the first place, so it's deferred until one is actually found.

### Privacy: SDK defaults, not `sendDefaultPii`

`sendDefaultPii` is deprecated as of Sentry JS SDK 10.54.0, replaced by a `dataCollection` option with per-category toggles (headers, cookies, user info/IP, query params, request/response bodies). Critically, **leaving `dataCollection` unconfigured** gives the most conservative behaviour on its own: headers sent with sensitive keys auto-scrubbed, cookies not sent, user info/IP not sent, query params scrubbed, bodies not captured (size only). Configuring `dataCollection` at all flips unspecified categories to more permissive. GigLoop's error paths routinely carry musician and client PII (a booking payload's contact email/phone, the `to` address in the mail-send path that triggered this issue) — neither SDK's `dataCollection` nor `sendDefaultPii` is set, so no request body, cookie, or IP ever leaves the process.

The one piece of context worth having — which tenant hit the error — is attached per-event via `Sentry.captureException(exception, { tags: { userId } })`, not `Sentry.setTag`/`Sentry.setUser`. Passing tags with the capture call is unambiguous per-event; `setTag` mutates ambient scope and would depend on the Nest SDK's request-isolation behaving as expected, and `setUser` is the API conceptually tied to the "user info" PII category — both are the wrong shape to reach for here.

### Enablement, environments, and alerting

- Gated purely by `SENTRY_DSN` / `VITE_SENTRY_DSN` presence — no separate on/off flag, matching every other provider var in `.env.example`. Unset locally; set in both preprod and prod.
- `environment:` on the API is a **new, explicit** `SENTRY_ENVIRONMENT` var (`preprod`/`prod`), set directly in Railway alongside `SENTRY_DSN` — **not** derived from Railway's auto-injected `RAILWAY_ENVIRONMENT_NAME`. Checked against the live repo variables while grilling this: `RAILWAY_PROD_ENVIRONMENT=production` but `RAILWAY_PREPROD_ENVIRONMENT=preprod` — the prod side was never renamed to match ADR-0075's canonical pair (a leftover of the same shape as the `gigman-be / staging` leftover ADR-0075 §Context found once already; filed as #947). Reading `RAILWAY_ENVIRONMENT_NAME` at runtime would silently tag prod events `production`, and an alert rule scoped to `environment: prod` would then never fire — exactly the "looks installed but reports nothing" failure mode this ADR exists to avoid. An explicit var sidesteps depending on Railway's raw slug entirely. Web reuses the existing `VITE_ENVIRONMENT` (unset → `prod`, `'preprod'` on the preprod Vercel project), the same var `apps/web/src/lib/environment.ts` already reads for the UI badge — that one *is* already the canonical name, no rename pending.
- Sentry captures events in both preprod and prod, but the alert rule is scoped to `environment: prod` only. The ask is "a 5xx in prod reaches me without me looking" — preprod is synthetic-data and merges continuously, so alerting on it would be noise the human explicitly doesn't want, while still leaving the dashboard available for debugging a failed smoke test or migration rehearsal.
- `tracesSampleRate` omitted — errors only, no performance tracing. Tracing is a different product surface (span timing, separate billing dimension, its own sampling/filtering config) that this issue's trigger doesn't call for.

### Deferred, each its own future issue

- **Release tracking and source-map upload** (tying captured errors to the `v*` tag from `promote.yml`/`release.yml`, uploading source maps at web build time). A triage-quality improvement, not a visibility gate, and source-map upload specifically needs a new CI secret and build step that deserves its own review.
- **Slack alert routing.** Sentry's default project-owner email is enough to start; connecting Slack is a manual dashboard step, not code.
- **A React `ErrorBoundary` with fallback UI** on the web side. `Sentry.init()` alone captures uncaught global errors and unhandled rejections with no UI change; a render-crash fallback is a genuine UX improvement but a new shared component (approval-gated per CLAUDE.md) with its own design questions (what it says, whether it offers reload, whether it varies by route).
- **Resend bounce/delivery-delay webhooks** (`email.bounced`, `email.delivery_delayed`) — these don't throw, so Sentry won't see them regardless. Already called out as out-of-scope in #744's original text.

## Consequences

- Two new packages: `@sentry/nestjs` (apps/api), `@sentry/react` (apps/web).
- Three new `.env.example` entries: `SENTRY_DSN`, `SENTRY_ENVIRONMENT` (apps/api), `VITE_SENTRY_DSN` (apps/web) — off locally, set in preprod and prod.
- Manual, human-only post-merge steps (not blocking the code itself, same shape as #785's prod-var follow-up): set `SENTRY_DSN`/`SENTRY_ENVIRONMENT` in Railway and `VITE_SENTRY_DSN` in Vercel for preprod and prod; confirm `VITE_SENTRY_DSN` is **not** marked Sensitive in Vercel (the #733 trap — a Sensitive `VITE_` var bakes as `""` and the feature silently never turns on); confirm the Sentry project's alert rule is scoped to `environment: prod`.
- A provider failure that's mismapped to a 4xx elsewhere in the API stays invisible to Sentry until someone notices and files it — accepted, not fixed here.
- Frontend render crashes still show a blank white screen; they'll be visible in Sentry (via the global handler) but the user sees nothing better than today until the `ErrorBoundary` follow-up ships.
