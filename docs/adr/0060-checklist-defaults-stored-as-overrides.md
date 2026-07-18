# ADR-0060 — Checklist defaults stored as overrides, merged against the catalogue on read

**Status:** accepted — amends ADR-0016 (stored checklist model) and ADR-0015 (preferences as JSON columns). Grilled 2026-07-18 (#624); parked from the checklist-defaults audit (PRD #613 / PR #623).

## Context

The checklist **catalogue** — `CHECKLIST_DEFAULTS` in the API, the opinionated system-authored set of [[Goal]]s and [[Step]]s (ADR-0057) — changes regularly: goals get collapsed (#616 quote, #617 invoice), steps get added (the 3→4 invoice spine), labels and keys get renamed. But a musician's *configured* defaults were stored as a **full materialised snapshot** of that catalogue at `UserProfile.preferences.checklistDefaults`, and `GET /me` returned that snapshot **verbatim** (`getChecklistDefaults`: a non-empty stored array is returned as-is; only an empty one falls back to the live catalogue).

That made every catalogue change structurally unsafe for any user who had ever opened checklist settings:

- The stored snapshot kept referencing **retired keys/labels** until a bespoke migration rewrote it.
- The save path validates each incoming override key against the *current* catalogue (`SYSTEM_KEYS = new Set(CHECKLIST_DEFAULTS.map(d => d.key))`). So between deploying a catalogue change and running that migration, a Settings → Checklist save **400s** on the stale keys — the #609 hard break.
- The mitigation was reactive and brittle: a **per-collapse template-migration script** (`migrate:quote-goals`, `migrate:invoice-goals`, …) plus a hard **deploy-then-migrate ordering** requirement ("run immediately after deploy or users 400").

Two facts make the fix cheaper than it looks. The DTO was **already override-shaped** — `UpdateChecklistDefaultsDto` only accepts `{enabled?, dueDateRule?}` per system key, `customItems`, and a global `reminderLeadDays`; it never accepts step spines. Only *storage* and *read* materialised a snapshot. And the sibling [[Package Template]] model already moved the other way: its library starts empty and the system defaults are a read-only starter catalogue (`GET /packages/catalogue`), never a seeded snapshot (#663, ADR-0046). Checklist defaults are the last snapshot-of-a-catalogue holdout.

## Decision

Store checklist defaults as **overrides only**, and derive the effective template by **merging those overrides onto the current catalogue at read time** (read-merge). The catalogue is the single source of truth for structure; the user owns only their deltas.

### 1. Read-merge, not snapshot — improvements auto-inherit

The effective checklist is `merge(CHECKLIST_DEFAULTS, storedOverrides)`, computed on every read. A catalogue improvement (new goal, split step, relabel, retuned default) therefore reaches **every** user automatically — including one who has customised — with no migration. This reverses the former **freeze** semantics, where a customised user was stuck on their snapshot until a migration pushed the change.

### 2. The override field set is the catalogue-owned / user-owned contract

Under read-merge the set of override fields is a hard boundary: anything that is *not* an override can only ever come from the catalogue, so making it user-tunable later means expanding the schema.

- **User owns (persisted as overrides):** per-goal `enabled`, per-goal `dueDateRule`, global `reminderLeadDays`, and **custom items** (owned outright; `key: null`).
- **Catalogue owns (always fresh at read):** `label`, `steps`, `concern`, `requiredForStatus`, `autoCompleteRule`, `order`.

### 3. Sparse deltas — an override is only a *difference*

An override is persisted **only when it differs from the current catalogue default** at write time (the writer diffs against `CHECKLIST_DEFAULTS`, including a structural comparison of `dueDateRule`). This is what makes auto-inherit deliver *retuned defaults*, not merely *added goals*: a field the user left at the default carries no override and tracks the catalogue. (The former writer re-materialised every field — which, under read-merge, would pin every user to their snapshot and defeat inheritance.)

### 4. Drop-on-read closes the save-break window

On read, a stored system override whose `key` is **absent from the current catalogue** is **silently dropped**; custom items (`key: null`) are never dropped. A retired key becomes a non-event instead of a 400, and the per-collapse **template-migration mechanism retires entirely**.

### 5. Order is derived, and custom items slot into their stage

`order` is no longer stored. The merged list is grouped by `requiredForStatus` stage; within each stage, catalogue goals come first (in catalogue order), then that stage's custom items (in stored order). A custom item files under its own lifecycle stage rather than being stranded at the tail. (Seeding *inclusion* is already driven by `requiredForStatus`, not array position — this governs only display/seed *sequence*.)

### 6. `GET /me` response shape is unchanged

`/me` still returns the effective checklist as an array of full item definitions — now **derived** rather than **stored**. Only the storage representation changes (a materialised array → an overrides object). The configurator renders the derived list exactly as before, so the frontend is untouched by the storage change. This keeps the blast radius to the writer and the read helper.

### 7. Crossover is a clean start — no migration script

At the time of this decision, prod is a **single account (the owner's) with no bookings**. There is therefore no meaningful legacy data to preserve and no user to 400. Rather than build crossover machinery we will never need again:

- **No migration script** — not one-shot, not lazy delta-extraction.
- The reader is **defensive**: a stored `checklistDefaults` that is not the new overrides shape (a legacy array, or anything malformed) is treated as **no overrides** → the user gets the pure current catalogue. Never a 400. This fallback is permanent hygiene, not a transitional branch.
- Any preference currently stored is discarded on cutover and re-applied once by hand.
- Seed scripts / preprod synthetic data that emit the old shape are updated **in code**, not migrated as data.

This is safe permanently **provided it ships before real users exist** — from cutover on, every save writes the new shape, so legacy-shape blobs only ever exist in today's empty window. Doing it now, against an empty prod, is the whole reason it needs no migration.

## Considered options

- **Snapshot + migrate, formalised** (status quo). Keep the materialised snapshot and standardise/automate the per-collapse migration so it can't be forgotten. Rejected: it keeps the deploy-then-migrate ordering hazard and the freeze semantics; it treats the recurring migration as permanent rather than removing the need for it.
- **Explicit-value overrides** (persist whatever the panel posts, no diff). Simpler writer, but it pins any user who opened Settings to their values, so catalogue *default* improvements never reach them — auto-inherit would deliver only newly-added goals. Rejected for defeating half the point (see §3).
- **One-shot / lazy crossover migration.** Correct if there were data worth preserving; here there is a single disposable blob and no bookings. Rejected as machinery for a non-problem (see §7).

## Consequences

- **The recurring template migration retires.** `migrate:quote-goals`, `migrate:invoice-goals`, and their `planQuoteTemplateMigration` / `planInvoiceTemplateMigration` planners are no longer needed for future catalogue changes, and the "run immediately after deploy or users 400" rule goes away. The scripts may be deleted once the overrides writer/reader lands.
- **The booking-row migration does *not* retire.** Live `BookingChecklistItem` / `BookingChecklistStep` rows already seeded onto bookings are persisted snapshots *by deliberate decision* (ADR-0057) — read-merge governs the *template*, not seeded booking rows. A catalogue collapse still needs the booking-row reshape + evaluator sweep — the reusable pure planners `planQuoteMigration` / `planInvoiceGoalMigration` are retained for that, while the **spent one-off apply drivers** (the `migrate:*` scripts that already ran for #616/#617/#653) were deleted (#706). This ADR does not touch the booking-row half and must not be read as a promise that catalogue changes are free at the booking level. (There are zero booking rows in prod today, so nothing to run now — but the planner logic stays; a future collapse authors a fresh apply driver over it.)
- **Writer and read helper change; DTO and `/me` response do not.** The work is: the writer diffs against the catalogue and emits an overrides object; `getChecklistDefaults` becomes a merge (`catalogue + overrides`, drop-on-read, stage-ordered customs); the reader is made defensive to non-conforming blobs.
- **The catalogue becomes the unambiguous single source of truth** for checklist structure, matching the Package Template direction (#663, ADR-0046). Adding, relabelling, or re-sequencing goals and steps becomes a catalogue-only edit with no user-data blast radius.
