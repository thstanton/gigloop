# ADR-0074 — Band communications: every comm is a pair, every send is per-person

## Status
Accepted (2026-08-19). Charted by the wayfinding map [#814](https://github.com/thstanton/gigloop/issues/814); decided across [#818](https://github.com/thstanton/gigloop/issues/818), [#822](https://github.com/thstanton/gigloop/issues/822), [#842](https://github.com/thstanton/gigloop/issues/842), [#868](https://github.com/thstanton/gigloop/issues/868), [#817](https://github.com/thstanton/gigloop/issues/817), [#857](https://github.com/thstanton/gigloop/issues/857). **Amends [ADR-0057](0057-checklist-goals-composed-of-steps.md)** (a new step state) and activates the `BAND_MEMBER` actor it left dormant. Satisfied by — not amending — [ADR-0064](0064-one-substitution-engine-bodies.md). Companions: [ADR-0072](0072-band-roster-chairs-and-members.md), [ADR-0073](0073-band-portal-visibility-and-projection.md).

## Context

Deps are not reached the way clients are. A client has an email address on file and expects email; a dep is reached however that particular dep is reachable — often WhatsApp, often no email at all. GigLoop's entire comms stack assumes email: one compose sheet, one send endpoint, one `Communication` row, one audience.

Three further gaps surfaced while charting. The invite wants a calendar attachment. Every send today renders for a **human compose sheet** and takes the body back from the client — even the invoice send, which attaches a server-generated PDF. And the only server-rendered path, the digest, uses `sendBatch()`, **which cannot carry attachments**.

## Decision

### 1. Every band comm is a PAIR — an email and a copy-paste message (#822, #842)

Three comms, six templates:

| Comm | Email carries | Message carries | Status effect |
| --- | --- | --- | --- |
| **Invite** | `.ics` + portal link | portal link | `→ INVITED` |
| **Call sheet** | PDF + portal link | portal link | none |
| **Final details** | portal link | portal link | none |

The message is **its own artifact, not the email flattened**: a WhatsApp message can carry neither an `.ics` nor a PDF, and is read in a two-line preview. Each pair is a built-in template type, Templates-page editable, with reset-to-default.

**Email and copy are peers — no primary path.** The only asymmetry falls out of the data: email is disabled when `Contact.email` is null; copy always works, at any status.

⚠️ #822 originally decided **one** message, the invite. That was reversed: with three emails and one message, the dep with no email address received the invite and then nothing — making email primary by omission, against #822's own peers rule.

**Rendering is a third adapter, not a second engine.** `tiptap.renderer.ts` (HTML) and `tiptap-pdfmake.ts` already sit downstream of the one `resolveVar` engine, so ADR-0064 is satisfied by the existing pattern. The editor **hides its formatting controls** for plain-text template types — otherwise a leader bolds text, sees it bold, and pastes flat.

**One shared `buildBandMemberContext(userId, bookingId, memberId)`** overlays member facts onto the per-booking `buildContext`. Both channels consume it, or the message and the email eventually disagree about Dave's call time.

### 2. Every send is per-person. There is no fan-out (#842)

Five chairs means five taps. This dissolves the problem that opened the question: with nothing server-initiated, there is **no fan-out**, no partial-failure policy, no which-members-flipped ambiguity, and `Communication` granularity is per-dep by construction.

Each comm gets its **own render + send pair in the band module**, on the `InvoiceTransitionService.send()` precedent: own endpoint, own DTO, **body from the client's compose sheet**, server attaches what only the server can build, `comms.sendEmail()` as the single logging and re-evaluation site, then the status flip.

Rejected: growing `bandMemberId` onto the shared `/communications/render` (already carrying four parameters) and `/send`, which would give `communications` knowledge of what `INVITED` means.

⚠️ **The band service fires its own `reeval.onBookingChanged()` after the status flip.** `sendEmail()` fires one *before* it, and band is the first send whose checklist step reads something `sendEmail()` does not write — every existing sent-step reads `Communication.status`, whereas §5's steps read `BookingBandMember.status` so the non-email channels work too.

### 3. "Mark as sent" logs a real `Communication` (#842)

The copy affordance's toast carries a **`Mark as sent`** action — a second, differently-labelled tap, so **copy is still not send**. It POSTs the pasted body to the existing `POST /bookings/:id/communications` endpoint, writing **`channel: 'MANUAL'`**; GigLoop's own sends stay `'EMAIL'`. For the invite it also flips `INVITED`.

`Communication.channel` and `direction` already existed as dormant columns, so this costs no migration. The distinction matters: *"GigLoop emailed this"* and *"you told us you sent this"* are different claims, and **only the first can promise the `.ics` or PDF actually went**.

⇒ **every band comm is in the booking's trail whatever the channel**, surfaced in a conditional `Client | Band` tab group on the Communications section, rendered only when the booking has members.

### 4. The `.ics` is hand-rolled, floating-time, and method-less (#818)

**GigLoop stores no timezone and no gig start instant** — `Booking.date` is a UTC-midnight *calendar date*, and time-of-day lives only in a nullable free-text `PerformanceSet.startTime`. **Floating time** (RFC 5545 form #1) is therefore the honest wire format and needs no `VTIMEZONE`. Neither candidate library generates one, so both solve the easy half; hand-rolling adds no dependency.

**`METHOD` is omitted entirely** — §3.7.2 blesses this, and `METHOD:REQUEST` would open a second confirmation channel the app cannot see, against §5's one-shot portal response. ⇒ `Content-Type: text/calendar`, no `ORGANIZER`/`ATTENDEE`, no `SEQUENCE`.

**`UID` = `bookingId` + `contactId`**, not the member row id — a re-invite creates a fresh row, and keying on it would *duplicate* the diary entry rather than update it.

⚠️ **Accepted limitation: removal cannot retract a calendar entry.** The dep's link 404s; the diary entry stays.

### 5. Two checklist goals, and a new step state (#817, #868, #857)

**`get_the_band_confirmed`** — `requiredForStatus: READY`, due `bookingDate−60`. Two preconditions (`Choose a lineup`, `Fill every chair`) then a **pair per person**: `Invite {name}` (USER/ACTION) → `{name} confirms` (**BAND_MEMBER**/AWAITED). This activates the actor ADR-0057 declared and left dormant; `GoalRow`'s CTA suppression applies only to AWAITED non-USER steps, and band steps **deliberately nag and name the person**.

**`get_the_band_briefed`** — `requiredForStatus: COMPLETE`, due `bookingDate−2`, one `Brief {name}` step per member. The two goals therefore render in **different sections** (Confirmed and Ready respectively), which is what earned the second goal.

Steps are **per-person, not aggregate**, because `shortcutType` is derived per row: an aggregate row could only offer "open the Band sheet", never a person-named action. This costs nothing visually — `GoalRow` shows one active step plus an `x/y` counter — and makes two-days-out a worklist.

**Audience:** every non-removed member except `DECLINED`, and except `isSelf`. The call-sheet email gets **no step** — its link already reaches every dep three times, and ADR-0073 designed it as a push for the dep who will not open a link.

⚠️ **ADR-0057 gains a new general step state, `DECLINED`** — the answer arrived, expectedly, and it was no. Terminal, non-contributing, **excluded from `milestoneProgress`**, muted glyph. Never `FAILED`, which must keep meaning *unexpected*. `quote_accepted` and `contract_signed` are later adopters.

**The ratchet holds — the chair re-opens.** A declined pair stays COMPLETE+DECLINED (honest history); `chair.memberId` goes null and `Fill every chair` re-opens, with the band service **resetting the goal explicitly** on regressing roster mutations. `Fill every chair` completes only when no chair holds a `DECLINED` member.

**Discovery and exit.** `get_the_band_confirmed` is seeded on every booking as an ordinary default — so the checklist **is** the discovery surface, and ADR-0072 §6's conditional surfaces are *working* surfaces. `AddToTheDayCard` gets no band row. The band goal carries an inline **"Playing this one solo?"** action that skips this booking's goal and writes the `enabled: false` default for **both** band goals.

## Consequences

- The dep with no email address is a first-class case, not a degraded one.
- Six default template bodies to write and keep in sync — the accepted price of the pair rule.
- `Mark as sent` is the first web caller of a previously dormant endpoint, and `navigator.clipboard` is the app's first use in `apps/web`.
- **No change-notification of any kind** ships in v1 — push notification needs the same trigger list versioning needed. A *pull-based portal indicator* is materially safer if it returns: a hash of the member's rendered `BAND_PORTAL_FIELDS` projection, with ADR-0073's table serving as the trigger list.
- A soloist meets the band feature once, on the checklist, and can switch both goals off in one tap.

## Alternatives considered

- **A bulk "invite the band"** — rejected; it reintroduces fan-out, partial failure and status ambiguity for a saving of four taps. A bulk *final details* was reconsidered separately (it flips no status) and rejected as **channel-asymmetric**: you cannot bulk-copy-paste, so it would quietly make email primary.
- **An `.ics` library** — rejected; both candidates omit `TZID` handling entirely, solving the easy half.
- **Auto-sending final details by cron** — rejected; it would be the app's first autonomous send to third parties, unseen by the organiser, with no timezone from which to pick an hour.
- **A `WHATSAPP | SMS | MESSENGER` channel vocabulary** — rejected; it turns a deliberately fast one-tap toast action into a picker, for data nothing computes over yet.
- **Deriving the checklist step from the `Communication` row** (as every other sent-step does) — rejected; a WhatsApp invite creates no row until `Mark as sent`, so the step would never complete for the manual path.
- **Deps ticking checklist steps on the portal** — out of scope. ADR-0031's revisit trigger is satisfied by v1 *shipping*, not by v1 building it.
