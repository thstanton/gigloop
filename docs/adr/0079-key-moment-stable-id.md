# ADR-0079: Key moments get a stable id; responses snapshot rather than join

- **Status:** Accepted
- **Date:** 2026-08-21
- **Closes:** #532 (grilled 2026-08-21)
- **Related:** ADR-0046 (packages defanged, key moments owned by the music form), ADR-0065 (genre vocabulary), ADR-0068 (Invoice as sole, snapshotted money record — same "frozen at the moment of truth" pattern)

## Context

A `KeyMoment` (`MusicFormConfig.keyMoments`, user-facing "Special Requests") is `{ label: string, section: string }` — no id. The client's submitted answer (`MusicFormResponse.specialRequests`) matches each entry to a moment by `key === label`, a plain string compare done independently in four places: the portal submit handler, the admin `MusicFormSection` render, the SONG_LIST PDF, and the musician notification email.

Because the join key is a mutable label: renaming a moment after a client has submitted silently orphans their answer (it stops matching anywhere, with no error), and two moments sharing a label collide (one answer renders twice, the other is lost). The music form ships live in prod with no feature flag, and `MusicFormResponse` rows are irreplaceable client submissions — there is no re-entry path once an answer silently vanishes.

A related, pre-existing fragility in `bookings.repository.ts`'s `removePackage` — which reassigns a moment's `section` to `"Other"` by matching `section === packageLabel`, called out in its own comment as an "accepted edge" — is explicitly **not** addressed here; it's a different join (config-to-package, not response-to-moment) and out of this issue's scope.

Checked against live data before designing the migration: prod holds 45 `MusicFormConfig` rows (180 moments) but only **one** `MusicFormResponse` row (5 entries), and all five already match their moment uniquely and cleanly — there is no existing orphaned or collided data to design a recovery policy for.

## Decision

**`KeyMoment` gains a stable `id: string` (UUID v4), minted server-side and held for the moment's lifetime** — immune to rename, reorder, or regroup. `MusicFormResponse.specialRequests` entries change from `{ key, songId?, freeText? }` to `{ momentId, label, section, songId?, freeText? }`, where `momentId`/`label`/`section` are **snapshotted from the live config at the instant the client submits, and never re-derived afterwards.** A response is a frozen historical record of what was asked and answered — not a live view — the same pattern already used for Invoice (ADR-0068) and for a booking-owned Package snapshotting its PackageTemplate's `label`/`icon` at apply time.

Mechanics:

1. **Identity lives only where it's needed.** `PackageTemplate.keyMoments` stays a bare `String[]` — a template is never matched against a response, only snapshotted into a fresh, freshly-id'd `MusicFormConfig` moment when applied. No schema change there.
2. **Ids round-trip through the admin editor, not through inference.** `KeyMomentDto` gains an optional `id`; the editor sends back the id of every moment it isn't creating fresh, and omits it for new ones. The server keeps an incoming id verbatim (trusted — it's the musician's own authenticated edit of their own booking) and mints a fresh UUID for anything arriving without one. Diffing the incoming array against the stored one by position or label was rejected — that's exactly the unstable-signal matching this ADR removes.
3. **The portal submit contract tightens to match.** `SpecialRequestDto.key` becomes `@IsUUID()`. The server validates every submitted id is among the booking's currently-published moment ids and rejects duplicate ids within one submission — both 400, mirroring the existing `assertSongIdsOwned` pattern for song ids. Previously any string was accepted with no validation at all.
4. **Rename is no longer a hazard.** Because the join key doesn't move on rename, the originally-reported failure mode is fixed by the id switch alone. The only remaining live hazard is **delete**: a moment removed from the config after a client answered it. The snapshot design means the answer's data is never lost regardless — but the admin's "current form" view (which joins live config to responses by `momentId`, replacing the old label join) would stop surfacing it. A second block, "previously answered — question since removed," renders any response entries whose `momentId` no longer resolves, directly from their own frozen `label`/`section`. PDF and email generation are unaffected in substance — both already read/write within the same submit request, so their join was always atomic; it's now correct by construction rather than by luck.
5. **Migration is a data backfill, not a schema migration** — both columns stay `Json`. A one-off, human-confirmed script: mint an id for every existing config moment (lossless, unconditional). For every existing response entry, resolve the *unique* label match against its booking's config and remap to `momentId`/`label`/`section`. Given the confirmed-clean live data, the script **asserts exactly one match per entry and hard-fails, naming the offending row, if it ever finds zero or more than one** — no silent fallback/drop/best-effort logic. The old `key` field is left in place on migrated rows (harmless, costs nothing) so pre-deploy app code is unaffected by the backfill having already run.
6. **Deploy order: backfill script first, then the new code.** Because the backfill is purely additive and leaves `key` intact, old app code never sees a shape it doesn't expect during the gap, and new code — deployed once the script has confirmed 100% clean — only ever reads the new fields. No dual-shape compatibility code is written into the application at all.

## Consequences

- The invariant "every `specialRequests` entry has a valid `momentId`" holds unconditionally after this ships — guaranteed for existing rows by the migration's hard assert, and for all future rows by submit-time validation. No `momentId: null` / "unmatched" runtime branch exists anywhere in the application; one was deliberately not built, since the data guarantees mean it can't occur.
- If the backfill script's assert ever does fail (state changing between this ADR and ship day), that's a deliberate stop for a human to look at the one specific row — not a policy decision made in advance for hypothetical broken data.
- `removePackage`'s label-matched `section` rewrite is unaffected and untouched — it spreads `{...m}` when rewriting, so the new `id` field passes through unchanged.
- The `key` field on migrated `MusicFormResponse` rows becomes dead once the new code ships; not worth a separate cleanup pass given it's a handful of rows in a `Json` column.

## Alternatives considered

- **Slug derived from the label** instead of a UUID. Rejected: re-collides the moment two moments legitimately share a label at creation, and goes stale (misleading) the instant the label is renamed — worse than no id for the readability it would have bought.
- **Server infers moment identity by diffing** the incoming edited array against the stored one (by position or fuzzy label match). Rejected: reintroduces a heuristic match on exactly the unstable signal this ADR removes; a rename+reorder in one save would be genuinely ambiguous.
- **`PackageTemplate.keyMoments` also becomes id-bearing.** Rejected: no lifecycle reason for it — it's never matched against a response, so identity would be unused schema churn.
- **Live join instead of snapshot** (`MusicFormResponse` stores only `momentId`, renders by looking up the current config every time). Rejected in favour of the snapshot: inconsistent with how Invoice/Package already treat "point of truth" data in this codebase, requires a config lookup for every render path (including PDF/email regeneration, which don't currently need one), and still needs its own orphan-display fallback for delete.
- **Preserve-verbatim fallback (`momentId: null`) for already-broken backfill rows.** Designed first, then dropped after checking live data: prod has exactly one response row and it resolves cleanly, so the fallback path would ship untested against a real case it's meant to handle. An assert-and-fail script was judged more honest than trusting unexercised fallback logic on the one row that matters.
- **Reject a stale in-flight portal submission (moment deleted between page load and submit) with anything more graceful than a generic 400.** Rejected for now: treated as ordinary form staleness. Sentry error alerting (ADR-0077) is already live, so this can be revisited with real signal if it turns out to matter in practice rather than designed for speculatively.
