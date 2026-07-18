# UAT report — onboarding (2026-07-08)

**Environment:** local dev (`http://localhost:5173`) · **Branch/commit:** `feature/478-onboarding-rework` @ `ef47ce9`
**Personas:** Graham (desktop 1280px, patient reader) · Chloe (mobile 375px, impatient skimmer) · Raj (mobile 375px, methodical verifier)
**Task script:** `docs/uat/tasks/onboarding.md` (sign-up → 5-step onboarding → first booking → "what now?")

## Executive summary

All three personas completed all four tasks — **zero product Blockers** — and the
flow's structure held up under its hardest tests: the skimmer skipped step 2
wholesale plus the address, phone and logo, and still landed on her booking's
checklist knowing exactly what to do next; the sceptic's step-2 preference
(song requests off) verifiably carried through to his new booking. The pain is
concentrated in **consistency of language and taxonomy**, not flow: genre
labels leak raw enum identifiers (`FILM_TV_MUSICALS`) on every persona's
screen, a custom "Soul" genre is accepted in one step and missing from the
next, and two automation rules (checklist due dates, portal sharing) act
without ever showing the user their dial. If one change were made first:
humanise and unify the genre labels — it was the only defect all three
personas hit.

## Convergence matrix

| # | Finding | Severity | Graham | Chloe | Raj |
|---|---------|----------|--------|-------|-----|
| 1 | Genre taxonomy leaks raw enums; custom genre doesn't round-trip | Major | steps 07, 09 | step 06 | step 10 |
| 2 | Checklist due dates derive from an invisible, unfindable rule | Major | — | step 13 (soft) | steps 07, 23 |
| 3 | Two song-request off-switches with no visible relationship | Major | — | — | steps 08, 13 |
| 4 | "Portal is created for every booking" — but when does the client see it? | Major | — | — | step 11 |
| 5 | Catalogue song search has no empty/no-match state | Major | step 09 | — (search succeeded) | — |
| 6 | Sample email says "Jane Smith Music", not the entered business name | Minor | step 09 | — | step 12 |
| 7 | "Next: Checklist" button opens a page titled "Reminders" | Minor | step 11 (unremarked) | step 11 | step 18 (unremarked) |

## Findings

### 1. Major — Genre taxonomy leaks raw identifiers and doesn't round-trip (3/3 personas) — filed: #694 (labels), #697 (round-trip)
- **What happened:** Default genre chips render as `FILM_TV_MUSICALS`,
  `CONTEMPORARY`, `CLASSICAL` — all-caps snake case — in the step-3 package
  editor, beside custom chips that render as typed ("Soul"). Graham then found
  the step-5 song Genre dropdown offers a fixed list *without* the "Soul" he'd
  created one step earlier, filed two Motown songs "under Contemporary, under
  protest" — a wrong-taxonomy workaround — and only discovered post-booking
  that "Soul" had survived into the music form after all.
- **Evidence:** `graham/journal.md` steps 07, 09 · `graham/step-11.png`,
  `graham/step-18.png` · `chloe/step-07.png` · `raj/step-10.png`
- **Personas hit:** all three, unprompted, in the same words ("computer
  language leaking out" / "giving spreadsheet" / "a database identifier on my
  screen"). Raj adds the sharpest edge: if these chips are client-facing on
  the song form, the leak is outward-facing too. The round-trip half hit only
  Graham because only he created a custom genre — the reader is the persona
  who exercises taxonomy hardest.

### 2. Major — Due dates come from an invisible rule (2/3, one soft) — filed: #698
- **What happened:** Onboarding step 2 shows "Due in 5 days" with no
  reference point; after booking creation, concrete dates appear ("contract
  due 20 Jul, deposit due 19 Aug" against an 18 Sept gig) derived from a
  lead-time rule that is never stated and has no discoverable setting. Raj
  called it "the one piece of arithmetic in this app I can't yet audit";
  Chloe noticed "the dates appeared out of nowhere" but accepted them as
  sensible.
- **Evidence:** `raj/journal.md` steps 07, 23 · `raj/step-23.png` ·
  `chloe/journal.md` step 13
- **Personas hit:** Raj hard, Chloe soft, Graham not at all — he simply
  trusted the dates. The split is informative: the rule only needs to be
  *visible*, not configurable in onboarding, to satisfy the auditor without
  burdening the others.

### 3. Major — Song requests can be switched off twice, in two places, with no acknowledged relationship (1/3) — filed: #699
- **What happened:** Raj turned "Gather song requests" off via a step-2
  checklist toggle, then step 5 presented song requests as fully on and
  offered a second "Turn off song requests" button, which he also pressed.
  Nothing says whether these are one setting or two (a checklist reminder vs
  the portal form). The off-state *did* carry through to his booking's
  reminder set, so the plumbing works — the presentation contradicts it.
- **Evidence:** `raj/journal.md` steps 08, 13, 18 · `raj/step-13.png`
- **Personas hit:** Raj only — but only Raj toggled anything. Anyone who
  customises in step 2 will meet the same contradiction in step 5.

### 4. Major — Portal share-timing is an unanswerable trust question (1/3) — filed: #700
- **What happened:** Step 4 says "a personalised client portal is created for
  every booking" with a live preview exposing the user's email address — but
  nothing anywhere says when a client first *sees* it: on booking creation,
  or when the user chooses to share. For a user deciding whether to trust the
  app with draft data, that's the difference between a draft and a published
  document.
- **Evidence:** `raj/journal.md` step 11 · `raj/step-11.png`
- **Personas hit:** Raj only; Graham took the preview at face value and Chloe
  didn't read the copy. Note this is precisely the question the
  portal-visibility work (#534 / ADR-0054) exists to answer — one sentence of
  its language belongs in step 4.

### 5. Major — Catalogue search fails silently on no match (1/3) — filed: #701
- **What happened:** Graham typed "My Girl" into step 5's "Search the
  catalogue" and got nothing — no spinner, no results, no "nothing found" —
  and concluded his typing might not have registered. He recovered only
  because the "Not in the catalogue? Enter it manually" escape hatch is
  well-worded. Chloe searched "Can't Help Falling in Love" and got an instant
  hit, which isolates the defect: the search works; the *empty state* doesn't
  exist.
- **Evidence:** `graham/journal.md` step 09 · `graham/step-17.png` ·
  `chloe/journal.md` step 09
- **Personas hit:** Graham. Chloe's success is the useful contrast — this
  finding only bites when the catalogue lacks the song, which for a soul/
  Motown repertoire was immediately.

### 6. Minor — Email previews say "Jane Smith Music" two steps after learning your name (2/3) — filed: #695
- **What happened:** Step-5 sample emails are headed "Your quote from Jane
  Smith Music" despite the business name being entered in step 1. Graham
  briefly wondered "who Jane Smith was and why she was quoting my clients";
  Raj docked a point. The portal preview (step 4) personalises correctly,
  which makes the emails' failure to do so more visible.
- **Evidence:** `graham/journal.md` step 09 · `raj/journal.md` step 12 ·
  `raj/step-12.png`
- **Personas hit:** both readers; invisible to the skimmer, who read no
  preview content.

### 7. Minor — "Next: Checklist" opens a page titled "Reminders" (1/3 explicit) — filed: #696
- **What happened:** The New-booking footer button says "Next: Checklist";
  the page it opens is headed "Reminders". Chloe: "why is the button called
  Checklist if the page is called Reminders". Graham and Raj both traversed
  the same mismatch without comment.
- **Evidence:** `chloe/journal.md` step 11 · `chloe/step-14.png`
- **Personas hit:** explicitly only Chloe — label-to-destination coherence is
  exactly what a skimmer navigates by. (This is the known unfinished
  "Checklist"→"Reminders" retitle from the Smart Reminders work, #553.)

Smaller polish notes (not padded into findings; all anchored in the journals):
"Series (optional)" is the one field with no helper text (`graham` step 10);
venue selection shows no confirmation until after save (`graham` step 10);
date picker forgets the navigated month on reopen (`raj` step 17); fee field
has no £ marker (`raj` step 17); icon pickers are unlabelled icon grids
(`graham` step 07, `chloe` step 06); default template ships two sets both
named "Evening Reception" (`graham` step 07); step-2/reminder toggles don't
say whether they save immediately or on Next (`graham` step 06, `raj` step 07).

## Candidate improvements

*(2026-07-18: findings filed as issues #694–#701 at the human's request — #694/#695/#696 ready-for-agent, rest needs-triage. The polish batch below remains unfiled.)*

1. Consider a genre label map (render `FILM_TV_MUSICALS` as "Film, TV &
   Musicals" everywhere, per the `lib/constants` convention) and reconciling
   custom package-genres with the song-form genre list — the only 3/3 finding,
   and possibly client-facing.
2. One fix for the due-date opacity would be a single line on the Reminders
   screen ("due dates are set from the gig date — contract 60 days before,
   deposit 30", with wherever the dial lives) — visibility, not new config.
3. Consider making step 5's song-request section reflect the step-2 toggle
   state (or, if they are genuinely two settings, say so beside the second
   switch).
4. One sentence in step 4 answering "clients see this only when you share it"
   — borrowable from the #534/ADR-0054 visibility language.
5. Add a "No matches — add it manually" empty state (plus a brief searching
   indicator) to the catalogue search.
6. Substitute the entered business name into the step-5 email previews.
7. Retitle the booking-form button "Next: Reminders" (completes the #553
   retitle).
8. Polish batch, if touching these files anyway: Series helper text, £ prefix
   on Fee, distinct default set names, labelled icons, date-picker month
   persistence.

## Persona journeys (appendix)

**Graham** (desktop, reads everything) — full journal:
[`assets/2026-07-08-onboarding/graham/journal.md`](assets/2026-07-08-onboarding/graham/journal.md)
"The most considerate setup I've been through — it explained its system
before demanding my data, and every question said why it was asking. A search
box that stays silent, a genre list that forgot my 'Soul', and a Jane Smith
who isn't me let it down — but nothing that would stop me recommending it to
the band, and that's not something I say about software."

**Chloe** (mobile, skims, 8-action cap) — full journal:
[`assets/2026-07-08-onboarding/chloe/journal.md`](assets/2026-07-08-onboarding/chloe/journal.md)
"five steps of setup?? but the skip buttons and prefills carried it — barely
typed anything. it pre-picked Wedding AND my ceremony package. ended on my
gig's checklist being told to get Megan's email, contract in 6 days. bossy,
but fine."

**Raj** (mobile, verifies everything) — full journal:
[`assets/2026-07-08-onboarding/raj/journal.md`](assets/2026-07-08-onboarding/raj/journal.md)
"'Nothing is ever sent without your say-so' and 'it never advances on its
own' — the two sentences a spreadsheet migrant needs, both present. My
step-2 preference carried through to the booking, and form → detail → list
all agree. Score kept on the invisible due-date arithmetic and turning song
requests off twice."

Worth preserving, per all three journals: field-level "where this data goes"
helper text; identical stage wording between onboarding and the booking form;
the full-page "Booking created" confirmation; the dashboard Actions list
surfacing exactly one correct next step ("Add the client's email") and
deep-linking to it.

## Skill calibration

- **Sign-up UI is untestable under automation:** Clerk's Turnstile CAPTCHA
  rejects the scripted browser (error 600010). All three executors created
  accounts out-of-band via the Clerk backend API and resumed through Sign in.
  Task 1 therefore covered the pre-CAPTCHA form and the sign-in flow only.
  Product-adjacent note worth keeping: when Turnstile fails, the sign-up form
  fields vanish with no error state (Chloe step 02). Fix for future runs:
  Clerk supports Testing Tokens to bypass bot detection — wire that into the
  executor setup.
- **TanStack devtools overlay** intercepted a bottom-tab tap on mobile (Raj
  step 15, hidden via script). Dev-only artifact; either run against preprod
  or hide the overlay in the executor preamble.
- Personas stayed in character throughout (Chloe never read body copy, ran on
  ~⅓ of Graham's tokens; Graham's four CAPTCHA attempts matched his patience
  budget exactly). No persona-file changes indicated.
