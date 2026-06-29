# ADR-0058 — Product renamed from "GigMan" to "GigLoop"

## Status
Accepted (2026-06-29). Branding/product decision. Supersedes the working title used since project inception. Relates to [ADR-0011](0011-visual-identity-rebrand.md) (visual identity — design system, not the name) and the deferred infra-rename follow-ups noted below.

## Context

"GigMan" was always a working title. A product name is needed before the public domain can be bought, which in turn gates enabling Resend (email) and Clerk (auth) on a real production domain. After shortlisting candidates (GigCue, Glisto, and others), **GigLoop** was chosen, paired with a distinctive wordmark set in **Major Mono Display** (loaded via Google Fonts).

The name appears in ~45 files. A scan separated them into three tiers by blast radius:

- **In-repo, user-facing + content** — wordmarks, body copy, portal/PDF footers, API docs title. Pure string changes.
- **In-repo, structural** — the three `package.json` `name` fields (`gigman`, `@gigman/api`, `@gigman/web`). The monorepo is `private` (never published to npm) and has **zero internal `@gigman/*` imports**, so renaming the scope is cosmetic and safe.
- **External / console infra** — GitHub repo, Cloudflare R2 bucket, Neon project, SonarCloud, CodeScene project. These live outside the repo and carry data-migration or CI-linkage risk.

## Decision

**Adopt "GigLoop" as the product name across all in-repo code, content, and living documentation now. Defer external/console infra renames, and defer all domain-tied strings until the domain is purchased.**

1. **Wordmark.** "GigLoop" in **Major Mono Display**, centralised behind a single Tailwind `font-wordmark` token (`apps/web/tailwind.config.ts`) used at every wordmark site (AppShell desktop + mobile, onboarding header, landing hero) — no repeated inline font styles.
2. **In-repo rename.** All user-facing copy, the portal footer and PDF footer ("Powered by GigLoop"), the API docs title ("GigLoop API"), and the three `package.json` names (`@gigloop/*`, root `gigloop`) + regenerated lockfile.
3. **Living docs updated; history preserved.** `CLAUDE.md`, `CONTEXT.md`, `docs/north-star.md`, `docs/agents/issue-authoring.md`, `PROMPT.md` are renamed. **Historical ADRs are left as dated records** — they intentionally retain "GigMan" as the name in force at the time. The `CONTEXT.md` "Smart Reminder" glossary entry (already flagged parked/historical pending the Goal⊃Step model) likewise retains "GigMan" for now.
4. **Domain-tied strings kept as placeholders.** The `noreply@gigman.com` email fallback, `.env.example` (`R2_BUCKET_NAME`, `CORS_ORIGIN`, `app.gigman.com`), and test mock domains are **unchanged** — the domain isn't live yet (a `TODO` in `mail.service.ts` confirms email isn't wired to a real domain). They move in a follow-up once the domain is bought.

## Consequences

- **User-visible surfaces now read "GigLoop"** in a distinctive wordmark; the rest of the app's restrained type scale is unaffected (`font-display`/Playfair remains for non-wordmark display text).
- **No code breakage from the package rename** — nothing imports the scope; only the lockfile regenerates.
- **Follow-up checklist (manual, external — not in this change):**
  - **Domain** (e.g. `gigloop.app`): buy → set prod `RESEND_FROM`, `CORS_ORIGIN`, portal-link base; add to Clerk allowed origins; verify in Resend; then update the placeholder strings above.
  - **GitHub repo** `thstanton/gigman` → `thstanton/gigloop` (GitHub auto-redirects old remotes; update local `git remote set-url` + the local directory name afterwards).
  - **Cloudflare R2 bucket** `gigman` — recommend **leaving** (rename = object migration; invisible to users).
  - **Neon project** `Gigman2` — leave (invisible).
  - **SonarCloud** — `sonar.projectName` → GigLoop is safe (display only); **do not** change `sonar.projectKey=thstanton_gigman` (it links CI to the dashboard).
  - **CodeScene** project `gigman` — optional rename via dashboard, then update `CLAUDE.md` ("default project").
