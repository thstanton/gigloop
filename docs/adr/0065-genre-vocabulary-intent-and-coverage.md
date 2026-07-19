# ADR-0065: Genre is a closed vocabulary; intent and coverage are separate concepts

**Status:** Accepted (2026-07-19)

**Context issues:** #697 (custom package genre missing from song dropdown), #530 (musician-configurable, library-aware default genres), #699 (two song-request off-switches in onboarding), #551 (package editor free-text genre input)

## Context

A musician typed "Soul" as a genre in the package-template editor during a UAT walkthrough. It was accepted. It flowed into the booking's music form. But the song genre dropdown never offered it, so two Motown songs were filed "under Contemporary, under protest."

Tracing it, the vocabulary was **half-closed**:

| Field | Validation | Effective |
|---|---|---|
| `Song.genre` | `@IsIn(SONG_GENRES)` | closed |
| `PackageTemplate.defaultGenreSelection` | `@IsString({ each: true })` | free text |
| `MusicFormConfig.enabledGenres` | `@IsString({ each: true })` | free text |

`CONTEXT.md` already declared the intended model — *"musicians cannot add custom genres"* — so the free-text `TagInput` in `PackageForm` was a defect against the documented design rather than a deliberate alternative.

The damage reached the client. A custom genre travels `PackageForm` → `defaultGenreSelection` → `applyPackageTemplate`'s suggestion → `enabledGenres` → `portal.service.ts`'s `findByGenres`. Because `Song.genre` can never equal "Soul", the client's portal renders **a "Soul" tab containing zero songs** — the musician advertising a gap in their own repertoire to a paying customer.

Two further problems surfaced while examining it:

- Every musician is shown the whole canonical list, in every picker. A jazz trio scrolls past Bollywood to file a song, and there is no way to say "these are the genres I do."
- `DEFAULT_ENABLED_GENRES` — a hardcoded four — seeds *every* musician's music form when no package is applied. A Motown act's client is offered **Classical** and **Film, TV & Musicals** because a frontend constant says so.

## Decision

### 1. The genre vocabulary stays closed. Widen it instead.

Genres remain a system-owned canonical set. Where the set is too narrow for a real act, **widen the constant** — a one-line change, no schema, no migration. The free-text input is removed and `@IsIn` validation is extended to `defaultGenreSelection` and `enabledGenres`.

A genre is not private metadata. The seed catalogue is filed against it, and it names a section on a form a client reads. A per-musician genre value is unmatchable against the catalogue and produces a client-facing section no song can fill — which is the bug above, not an incidental consequence.

### 2. Three genre concepts, previously conflated

One list was doing two jobs. Separating them dissolves every symptom:

| Concept | Kind | Storage |
|---|---|---|
| **Genre** | shared canonical vocabulary | `SONG_GENRES` constant |
| **My Genres** | the musician's stated **intent** | `UserProfile.myGenres String[]` |
| **Genres in Repertoire** | derived **fact** — genres with ≥1 active `Song` | not stored |

Intent is a *selection over* the shared vocabulary — not per-user genre *values*. That is what keeps it one additive column rather than a `Genre` table with a join.

### 3. Intent never constrains stored data

`My Genres` narrows pickers. It does not validate writes. `Song.genre` continues to validate against the canonical set.

A song's genre is a **fact about the song**; a template's `defaultGenreSelection` is a **saved configuration**. Neither may be invalidated by a later change of intent. Unticking Jazz must not reclassify twelve songs, must not silently rewrite saved templates, and must be instantly reversible.

This is also forced by `Genres in Repertoire` being derived: it changes whenever a song is deactivated, so it *cannot* be a constraint on stored values without saved templates spontaneously breaking.

### 4. Client-bound surfaces are bounded by intent ∩ coverage — absolutely

| Surface | Genres shown |
|---|---|
| Song genre picker | My Genres |
| Repertoire filter | My Genres ∪ Genres in Repertoire |
| **Package template editor** | **My Genres ∩ Genres in Repertoire** |
| **`enabledGenres`** | **My Genres ∩ Genres in Repertoire** |

The two musician-facing surfaces are permissive by design: the song picker must offer Jazz *because* there are no Jazz songs yet — that is how the first one is added; the Repertoire filter unions both so a genre stays filterable after it is unticked with songs still under it.

The two client-bound surfaces take the intersection, **with no empty-library exception.** An uncovered genre is shown *disabled*, carrying a song count and a route to Repertoire — the gap is named where it is relevant, not hidden. We considered relaxing this during onboarding (empty library ⇒ no gating) and rejected it: we cannot know an empty library is deliberate, and the failure it permits is outward-facing.

Counts (`Jazz (0)` beside `Contemporary (23)`) serve as the library-aware nudge #530 asked for. The number *is* the signal; no separate warning UI is needed.

### 5. `DEFAULT_ENABLED_GENRES` is deleted, not replaced

The constant existed so a client's form was never "tab-less" (#535). Under this decision it cannot survive — its four genres cannot be seeded unless they are covered.

That is correct, because the premise was wrong (see 6).

### 6. The music form gathers two independent classes of information

| Class | Requires |
|---|---|
| **Song Selection** — browse and pick from the repertoire | ≥1 genre in My Genres ∩ Genres in Repertoire |
| **Special Requests** — a request per moment, plus notes | nothing |

Neither implies the other. A form with no genres is **not degraded — it is a Special-Requests-only form**, exactly right for a musician who takes a first-dance request but publishes no repertoire.

#535 was solving a non-problem created by not having named these classes. Both the client's form and the musician's editor must present them as visibly distinct, and must make clear the genre selection drives **Song Selection only** — Special Requests search the whole library regardless. Absence of a class is explained with a *hint*, not a warning: nothing is wrong.

### 7. Onboarding step order is a dependency order

Two inversions existed, both because the master question and the library sat at the end:

- The `gather_song_requests` reminder (step 2) preceded its own master flag (step 5) — #699.
- The package genre picker (step 3) preceded the library its offerable genres depend on.

Resolved by moving the master question to **step 1** (it is a fact about the act, like the business name) and Songs to **step 3**, ahead of Packages:

| # | Step |
|---|---|
| 1 | Business — *including "do you take song requests?"* |
| 2 | Bookings |
| 3 | **Songs** |
| 4 | **Packages** |
| 5 | Portal |

Declining carries **visibly** forward: each later song-request surface renders inert, states why, and offers a way back. The relationship between the switches becomes a state the musician can see rather than something copy has to explain.

Root cause of #699 was narrower than it appeared: `ChecklistDefaultsConfigurator` already implements the gate (`MUSIC_FORM_GATED_CHECKLIST_KEYS`), and Settings passes it. `OnboardingChecklistPage` simply does not use the shared component — it rebuilt the list from `StageCard` + `Switch` and dropped the gate. With the master flag now set in step 1, the existing gate has a value to read.

## Consequences

**Good**

- The client-facing empty-tab defect is closed by construction, not by vigilance.
- Every genre picker becomes personal; no musician sees the full canonical list.
- #530 is satisfied without the `Genre` table it seemed to require — ask 1 is `myGenres`, ask 2 is the gap between intent and coverage, rendered as a count.
- #699 resolves as a consequence of the reorder; its hardest fork (what happens to a reminder set *before* the feature was chosen) disappears, because that ordering is now impossible.
- One additive nullable column. No destructive migration; expand/contract not required.
- #551's canonical picker remains correct — only its options source changes.

**Bad / accepted**

- We are in the business of curating a genre list. Every "can you add Klezmer?" is a deploy. Accepted as strictly cheaper than a per-user genre store plus its migration, and revisitable: opening the vocabulary later is a change to a *validation rule*, since the column and every narrowed picker already exist.
- A musician genuinely cannot offer a genre they have no songs in. Deliberate — a template promising Jazz with no Jazz is a promise they cannot keep.
- Reordering onboarding touches the #663/#668 step designs.
- Free-text genres already saved to `defaultGenreSelection` / `enabledGenres` in production need a decision (widen to cover, map, or drop) before `@IsIn` is enforced. Tracked separately.

## Alternatives considered

**Per-user genre store (open vocabulary).** Typing "Soul" creates a real genre for that musician, selectable everywhere. Fully solves the complaint. Rejected as a much larger change — new schema, a migration, per-user validation on every song write, and labels no longer derivable from a static map — for a symptom whose root cause is *inconsistency*, not insufficiency. The closed model with a widened set reaches ~90% of the benefit, and is a strict subset of this one, so choosing it now does not foreclose it.

**Hard-constraining stored data to My Genres.** Rejected in §3: a single untick in Settings could silently mutate an unknown number of saved templates, and the next client of an affected template would get a music form quietly missing a genre.

**Hiding uncovered genres rather than disabling them.** Equally safe for the client, but silent — the musician sees genres vanish, learns nothing, and the gap is invisible at exactly the moment they are thinking about genres.

**Allowing an uncovered genre with a warning.** Teaches, but leaves the client-facing failure available on a screen that gets clicked through quickly.

**Reordering onboarding songs-before-packages only (Songs at 3, master question left at the end).** Fixes coverage but leaves #699's inversion untouched — half a fix.

**Making step 2's reminder toggle the master switch.** Would have made the carry-through work, but conflates a product question with a reminder preference, and costs onboarding the legitimate "form on, reminder off" state.
