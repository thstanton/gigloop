# Grill decision record — Musician decorations (woodcut figures as score-cover ornament)

> **Status:** Decision record from a grill session (2026-08-18), branch
> `docs/musician-decorations`. Pre-implementation — captures the decided points,
> the governing rule, the asset spec, and the deliberately-rejected options, so
> the reasoning survives the session and the build can be issued from it.
>
> **Amended 2026-08-21** — two of the decided points below (site count,
> fixed-vs-random selection) were reopened and reversed after a `/prototype`
> pass. The original reasoning is left in place rather than rewritten; see
> **§Addendum (2026-08-21)** at the end for what changed and why, and #858 for
> the tracking issue.
>
> **Relates:** CLAUDE.md (UI Rules — the decoration rule added by this session);
> CONTEXT.md (`Musician decoration` glossary entry); ADR-0015 / CONTEXT.md:242
> (portal hero images — the *other* imagery system, deliberately untouched);
> ADR-0054 (portal visibility authority).
>
> **No ADR.** See §Why no ADR — reassessed in the addendum too.

---

## The idea

Four commissioned pen-and-ink figures of musicians, used sparingly to give the
admin UI character.

The organising rationale — supplied by the author, and the thing that makes the
rest of this document coherent — is that **the GigLoop admin UI already
deliberately evokes a printed musical score**, and the figures are drawn in a
woodcut/engraving style that echoes the decoration on a score's front cover.

That is not a post-hoc reading. It is encoded in the tokens:

| Token / setting | Value | Reading |
|---|---|---|
| `display` / `serif` | `Playfair Display` | high-contrast serif — engraved title-page register |
| `--background` | `38 30% 98%` | warm cream |
| `--dashboard-surface` | `35 35% 91%` | commented in `globals.css` as *"deeper warm parchment"* |
| `--foreground` | `25 25% 11%` | warm near-black — **not** pure black |

So the decoration is not generic app-mascot illustration. It is **score-cover
ornament**, and the printing metaphor decides placement, prominence and ink.

## Decided

1. **Decorative, curated placement — never semantic.** A figure carries no
   meaning the viewer must decode. It is not bound to a domain concept
   (pianist ≠ Repertoire), nor to a status, nor to a mood. A human picks which
   figure goes where; the picture says nothing the copy does not.

2. **Admin only. The client portal is untouched.** CONTEXT.md states the portal
   "is musician-branded, not GigLoop-branded". These figures are *GigLoop's*
   character; putting them on a client-facing page borrows the musician's stage
   for our brand. The client is also a wedding couple, not a musician — an
   illustrated trumpeter says nothing to them. The existing predefined hero
   images (`piano.png`, `stage.png` — atmospheric black-and-white *photographs*,
   `PortalHeroImage = 'piano' | 'stage' | null`, BOLD themes only) are a
   different system in a different visual register and stay as they are.

3. **Fixed selection, chosen by hand per site.** Not random. (Randomness was
   explored and reversed — see §Rejected.) **Superseded 2026-08-21 — see
   §Addendum.** Selection is now random, drawn from a uniform pool.

4. **The governing rule: at most one musician visible at a time.** A figure may
   appear only where no second figure can share the viewport — a whole page, or
   a modal. This is a *rule*, not a whitelist: a contributor facing a surface
   nobody has considered can apply it unaided.

5. **Three sites, by typographic role.** **Superseded 2026-08-21 — see
   §Addendum.** Only the stage-advance dialog ships initially; the other two
   rows below are the design reference for whenever they're picked back up.
   Prominence follows the role the ornament plays on a printed score, not the
   shape of the slot:

   | Role | Site | Prominence |
   |---|---|---|
   | **Title-page vignette** | Launch screen (`HomePage.tsx`, `/`, unauthenticated) | Generous — the centrepiece, in a spare field of parchment |
   | **Frontispiece** | Dashboard first-run block (`DashboardPage.tsx:398`) | Moderate — beside the welcome text |
   | **Tailpiece** | Stage-advance dialog (`BookingDetailSheets.tsx:121`) | Small — closes the movement; keeps the sheet's actions above the fold |

   The launch screen is GigLoop's title page and is currently near-empty (49
   lines: a 32px `Music2` icon, wordmark, one line of copy, two buttons). The
   advance dialog is a `ResponsiveDialog` — a **bottom sheet on mobile**,
   centred `md:max-w-lg` on desktop — which is why the tailpiece must stay small.

6. **No empty states carry a decoration.** CLAUDE.md's existing rule ("Empty
   states get an icon, a heading, one paragraph, and one CTA. Nothing else.")
   is **unchanged in substance** — this session added only a cross-reference to
   the decoration rule, no exception. See §Rejected: decorating empty states was
   decided, then reversed on evidence.

   Note the three sites are a **closed list**, not merely everything the rule
   permits. A page-level empty state would satisfy the one-at-a-time rule; it is
   excluded by decision. A fourth site needs approval.

7. **One shared component**, approved this session per CLAUDE.md's
   requirement that additions to `components/common/` be sanctioned:

   ```
   components/common/MusicianDecoration.tsx
   components/common/MusicianDecoration.stories.tsx   ← required, CI-scanned
   ```

   It owns the registry, the size scale, and the decorative-image
   accessibility (empty `alt` + `aria-hidden`, so assistive tech skips it —
   these figures carry no information).

8. **Assets live in `src/assets/musicians/`, not `public/`.** They are
   statically imported, so Vite content-hashes and optimises them.
   `piano.png` / `stage.png` correctly live in `public/` for the opposite
   reason: they are resolved at runtime from a slug held in
   `clientPortalConfig.heroImage`.

9. **The registry is a vocabulary**, so CLAUDE.md's "one declaration per
   vocabulary" rule governs it: one ordered `as const satisfies` table, one row
   per figure, derived exports, compile-time coverage check. Adding a musician
   is "drop the file, add the row" — with no second hand-written list to drift.

## Asset preparation (author, before build)

The current files are **not** usable as they stand.

| | Now | Needed |
|---|---|---|
| Background | Solid white, `8-bit/color RGB`, **no alpha** | Cut out to transparency |
| Weight | ~1.4 MB each | ~30× too heavy for decoration; resize + compress |
| Filenames | `ChatGPT Image Jul 25, 2026, 08_01_00 PM.png` | Stable slugs (`singer`, `trumpeter`, `guitarist`, `pianist`) |
| Ink | Pure black | Recommend `--foreground` (`25 25% 11%`, warm near-black) |
| Location | `apps/web/public/gigloop-musicians/` | `apps/web/src/assets/musicians/` |

**Why transparency matters here:** the page is warm cream, not white, so a
white-backed PNG shows as a pasted-on patch. Cut out, the hatching gaps let the
parchment through and the figure reads as *printed on* the page rather than
placed in a box.

**Why the ink matters:** the type is a warm near-black. Pure-black art sits
colder and harder beside it. Matching the ink makes figure and type look struck
from the same press — which is the whole point of the score metaphor.

**Mixed aspect ratios are fine** now that selection is fixed rather than random:

```
singer      1024 × 1536   2:3 portrait   figure
trumpeter   1024 × 1536   2:3 portrait   figure
guitarist   1024 × 1536   2:3 portrait   figure
pianist     1402 × 1122   5:4 landscape  scene (figure + grand piano)
```

The landscape pianist suits a wide, short slot — the dialog tailpiece is the
natural home, and he survives intact rather than being cropped to a figure.

## Deliberately rejected

**Random selection.** Explored at length and reversed. Random forces every
image to be interchangeable (any figure can land in any slot), which in turn
forces a single shape spec on the whole library — which would have meant
re-cropping the landscape pianist to a portrait figure, losing the grand piano.
It also costs a last-shown ref, non-deterministic stories, and a story override
prop. Fixed selection dissolves all of it. **The detour was still worth it:** it
surfaced the interchangeability constraint, which is only invisible *because*
we chose fixed.

**Revisited 2026-08-21 — reversed back to random.** See §Addendum. The
interchangeability constraint this section identifies is exactly what got
resolved: the pool is now being reprocessed to one uniform crop/size
specifically so every figure *is* interchangeable, which was the one thing
blocking random in the first place. The last-shown-ref / non-deterministic
story / override-prop costs are real and now paid deliberately — the story
override is written into #860's acceptance criteria.

**Decorating empty states.** Adopted, then reversed on evidence. Two findings
killed it:

- *Page-level first-run empty states* (No bookings / No songs / No contacts /
  No package templates) all fire inside a new user's first session — 4–6
  sightings in the first ten minutes, alongside the launch screen and dashboard
  welcome — and are then essentially never seen again.
- *Card-level booking empty states* (No details / No itinerary / No venue /
  No map / No music form) are the app's **most common** empty states — every new
  booking has them — and they render on the **same page**
  (`BookingDetailDesktop.tsx:91–105`, `BookingDetailMobile.tsx:158–174`). A
  fresh booking would stack **five** figures down one screen.

The second finding is what produced the one-at-a-time rule. The rule now
excludes the booking cards structurally rather than by taste.

**Semantic mapping** (figure → domain area, or figure → booking status). Four
figures cannot cover the app's concept space, and a semantic rule creates a
standing obligation to commission art for every new concept.

**Riding the `CELEBRATORY_TITLES` rotation.** The advance dialog already cycles
exactly four titles ("You're smashing it!" / "Nice work!" / "All done!" /
"You're on a roll!") — an appealing 4:4 pairing with four figures. Dropped when
selection became fixed, and the 4:4 was a coincidence the growing library would
have broken anyway.

**Error / 404 states.** All four figures are mid-performance and triumphant.
None reads as "something went wrong".

**An onboarding completion moment.** No such page exists — onboarding ends on
the fifth form step. Creating one would be building a room for the furniture.

**Adding the figures to the portal hero picker.** Register clash (line drawings
vs atmospheric photographs), and the hero is a full-bleed block under a dark
gradient overlay — line art would vanish into it.

## Open / for the build session

- **Exact pixel sizes** for the three roles. Judged by eye against real
  parchment, not fixed here. There is a floor: these are dense engravings and
  the hatching muddies when small — best settled by rendering one at several
  sizes and looking, rather than asserting a number (my ~120px estimate is
  judgement, not measurement).
- **Which figure goes to which site.** Taste, and easier with the processed
  assets in hand. The landscape pianist → dialog tailpiece is the one
  near-certain assignment. One of the four will be unused at three sites; that
  is fine and expected as the library grows.
- **`DashboardPage.tsx:398` is a second implementation of `EmptyState`.** It
  hand-rolls the same heading + paragraph + CTA pattern rather than using the
  component. Decorating it is correct under the one-at-a-time rule (it is a
  whole-page first-run block), but the duplication is worth noting: if the
  empty-state rule is ever revisited, this block is not governed by it. Not
  fixed here — flagged so it is not mistaken for an oversight.

## Why no ADR

The three-part test in the `domain-modeling` skill:

- **Hard to reverse?** No. Removing `<MusicianDecoration>` from three JSX sites
  is an afternoon.
- **Surprising without context?** The *rule* is worth writing down, but it
  belongs in CLAUDE.md where a contributor editing UI will actually meet it —
  not in an ADR they would have no reason to open.
- **A real trade-off with live alternatives?** Partly, and this document records
  those alternatives and why they lost.

Two of three, and the one that matters most is served better by CLAUDE.md. An
ADR would be ceremony. If the decoration system later grows a genuinely
hard-to-reverse commitment — theming the ink from a token, or a portal-facing
variant — that is when it earns one.

## Addendum (2026-08-21) — scope narrowed to one site, selection reversed to random

A `/prototype` pass (see #858) placed `violinist.png` — a newer source image,
already cut to transparency, still pure black — at all three approved sites
with a live size switcher, so sizing could be judged against real parchment in
the browser instead of guessed. The launch-screen vignette was confirmed live
at 140–260px; the other two sites were wired but not visually confirmed (no
authenticated session was available in the prototype environment). Having seen
it, two decisions above changed:

**Scope narrows to one site: the stage-advance dialog.** The launch-screen
vignette and dashboard frontispiece (decided points 5's other two rows) are
deferred, not abandoned — #861 (dashboard frontispiece) is closed as
out-of-scope for this pass; the launch-screen half of #860 is dropped. Revisit
both when there's reason to add a second site.

**Selection reverses from fixed to random.** Decided point 3 and the
§Rejected → Random selection entry explain why fixed won originally: the
landscape pianist's 5:4 scene couldn't survive being cropped to match the
other figures' 2:3 portrait, so random would have forced every figure into one
shape or cost the pianist his piano. That specific blocker goes away once the
whole pool shares one crop/size — which is happening anyway, now that the
figure count is growing past the original four and needs a scalable spec
regardless. With the pool uniform, random has no cost left to reject it for.

**Consequences for the open items above:**
- "Which figure goes to which site" — moot with one site; the figure is drawn
  at random from the full pool each time the dialog opens.
- The interchangeability constraint the §Rejected section identified is now a
  *requirement* on asset prep (#859), not a reason to avoid random.
- `DashboardPage.tsx:398`'s duplicate `EmptyState` implementation note still
  stands, unaffected — it's now simply not being touched this pass.

**Why no ADR, reassessed:** the three-part test still comes out the same way.
Reversing to random and back to one site is still an afternoon's diff; the
rule text still belongs in CLAUDE.md, not an ADR; the trade-off is real but
this document already records it (now with the reversal alongside the
original reasoning). No new ADR.

CLAUDE.md's UI Rule text has been updated to match. `docs/agents/` and the
tracking issue (#858) are the place to look for current sub-issue scope
(#859/#860/#862); this document stays the design reference for the reasoning
behind both the original and the amended shape.
