# The `band_invite` email and its `.ics` attachment

Research asset for [#818](https://github.com/thstanton/gigloop/issues/818), a ticket on
[Map: band members](https://github.com/thstanton/gigloop/issues/814). Written 2026-08-18.

**This is research, not a decision.** The dependency question needs the human's approval per
CLAUDE.md. Nothing here has been installed and no code has been written.

Every claim is tagged **[repo]** (verified by reading this codebase at `d2df9c1`), **[spec]**
(quoted from RFC 5545 or a vendor's own reference), or **[secondhand]** (community reporting —
treat as a hint, not a fact).

---

## 1. Recommendation in one page

| Question | Answer | Confidence |
| --- | --- | --- |
| `.ics` library or hand-rolled? | **Hand-rolled, ~40 lines. No new dependency.** | High — neither candidate library solves the one hard part |
| Time representation? | **Floating local time** (RFC 5545 form #1) — no `Z`, no `TZID`, no `VTIMEZONE` | High, but see the flip trigger in §4 |
| `METHOD:REQUEST`? | **No. Omit `METHOD` entirely** and omit the `method=` Content-Type parameter | High |
| `Content-Type: text/calendar`? | **Yes** — Resend supports `content_type`; the repo's `MailTransportOptions` must widen by one field | High |
| `UID` derivation? | **`bookingId` + `contactId`**, *not* the `BookingBandMember` row id | High — the row id duplicates the calendar entry on re-invite |
| `SEQUENCE`? | **Omit it** — meaningless without `METHOD`, and #819's fresh-row re-invite leaves it nowhere to live | High |
| One `VEVENT` or one per chair? | **One**, spanning the dep's own call time to the end of their last segment | Medium — depends on #826's chair schema landing |
| Does the substitution engine need changing for per-recipient variables? | **The engine, no. The context builder and the send path, yes** — this is the first server-rendered fan-out email in the app | High |

**The single most important finding** is not about `.ics` at all: `band_invite` is the first email
in GigLoop that the *server* renders and sends without a human compose sheet, and the first that
fans out to N recipients with N different bodies. Resend's batch API cannot carry attachments, so
it is also forced into N individual sends. See §8.

---

## 2. What already exists (verified in the repo)

- **Attachments are plumbed.** `MailService.send()` takes
  `attachments?: Array<{ filename: string; content: Buffer }>` and base64-encodes each for Resend
  (`apps/api/src/mail/mail.service.ts:32,180`). Used today for invoice PDFs
  (`invoice-transition.service.ts:133`) and the song-list PDF (`portal.service.ts:511`). **[repo]**
- **`MailTransportOptions` cannot express a MIME type.** The attachment element is
  `{ filename, content }` only — there is nowhere to put `text/calendar`. **[repo]**
- **Resend can.** The installed SDK (`resend@6.12.4`) types `Attachment` with an optional
  `contentType?: string` — *"Optional content type for the attachment, if not set will be derived
  from the filename property"* — which the SDK maps to the wire field `content_type`
  (`node_modules/resend/dist/index.d.mts:602,142`). **[repo]** Resend's own API reference agrees and
  caps attachments at *"max 40MB per email, after Base64 encoding"*. **[spec]**
- **`sendBatch()` cannot carry attachments.** The SDK types batch sends as
  `Omit<CreateEmailOptions, 'attachments' | 'scheduledAt'>`, citing Resend's documented batch
  limitations (`node_modules/resend/dist/index.d.mts`). The repo's `MailService.sendBatch()` already
  drops `attachments` on the floor — it destructures only `{ subject, body, to }`
  (`mail.service.ts:158-167`). **[repo]**
- **No `.ics` library is installed.** `apps/api` has 19 runtime dependencies and none of them is a
  calendar, date or timezone library — no `date-fns`, `dayjs`, `luxon`, `ics` or `ical-generator`.
  **[repo]**
- **Node 24.14 with full ICU.** `Intl.DateTimeFormat` resolves `Europe/London` offsets natively, so
  *offset arithmetic* would never need a dependency even if we chose to do it. **[repo]**
- **Built-in email types are a plain vocabulary with coverage specs**, not yet an
  `as const satisfies` table: `BuiltInTemplateType`, `TEMPLATE_DEFAULT_SUBJECTS`,
  `VARIABLE_FALLBACKS`, `BUILT_IN_EMAIL_TYPES`, `DEFAULTS`
  (`apps/api/src/templates/default-templates.ts`), guarded by `mail.service.spec.ts:433,468`.
  **[repo]**
- **Templates self-heal on read.** `TemplatesService.findAll()` diffs `ALL_BUILT_IN_TYPES` against
  the user's rows and seeds the missing ones (`templates.service.ts:12-19`). Adding `band_invite`
  therefore needs **no migration and no backfill** — with one trap, see §9. **[repo]**
- **ADR-0064's "one substitution engine"** is `resolveVar` in `apps/api/src/mail/tiptap-substitute.ts`,
  shared by the rich-text body path and the plain-string subject path. **[repo]**

---

## 3. The decisive constraint: GigLoop stores no time zone, and no gig start instant

This is the fact everything else turns on, and it was worth establishing before weighing any
library.

- `Booking.date` is `DateTime` **[repo]** — but it is written from a `YYYY-MM-DD` string
  (`bookings.repository.ts:193,232,284` do `new Date(date)`), and the picker that produces it emits
  a plain calendar date with no time component (`apps/web/src/components/ui/date-picker.tsx:19-25`).
  In production it is therefore **UTC midnight on the calendar date**, not an instant.
- The read side confirms the intent: the web slices it back as a date string —
  `booking.date.slice(0, 10)` (`BookingDetailSheets.tsx:180`, `BookingBuilderPage.tsx:633`) — and
  the digest formats it with `timeZone: 'UTC'` precisely so the calendar day cannot drift
  (`digest.service.ts:156,164`). **[repo]**
- **The gig's time of day lives only in `PerformanceSet.startTime`, a nullable free-text `String`**
  documented as `HH:mm` and validated by nothing stronger than `@IsString()`
  (`schema.prisma:292`, `create-set.dto.ts:15-18`). **[repo]**
- **There is no `timezone` field anywhere in the schema** — not on `Booking`, not on `Contact`, not
  on `PublicProfile`. `Contact` has `country String? @default("GB")` and `latitude`/`longitude`, but
  nothing that names a zone. **[repo]**

So the app's model of a gig start is *"this calendar date, at this wall-clock string"* — a local
time with no zone attached. Any `.ics` we emit either honours that or invents a zone the app does
not have.

---

## 4. Time representation — and why it settles the dependency question

RFC 5545 §3.3.5 defines three forms **[spec]**:

1. **Floating / local time** — `DTSTART:20260915T180000`. *"The date with local time form is simply
   a DATE-TIME value that does not contain the UTC designator nor does it reference a time zone."*
   It is interpreted in the **viewing device's** zone. The spec's own guidance: *"Floating time
   SHOULD only be used where that is the reasonable behavior."*
2. **UTC** — `DTSTART:20260915T170000Z`. Requires converting London wall-clock → UTC, i.e. knowing
   the BST rules and committing to a zone.
3. **Local time with `TZID`** — `DTSTART;TZID=Europe/London:20260915T180000`. Requires a
   `VTIMEZONE`: *"An individual 'VTIMEZONE' calendar component MUST be specified for each unique
   'TZID' parameter value specified in the iCalendar object."* (§3.2.19) **[spec]**

### Recommendation: floating time

It is the only one of the three that is *honest about the data we hold*. We store a wall-clock
string; floating time is the wire format for a wall-clock string. Forms 2 and 3 both require
inventing `Europe/London`, and hardcoding that would be **silently wrong for a non-GB user's non-GB
gig** — a case `Contact.country`'s GB *default* (rather than a constraint) says is possible.

Practical consequences:

- No `VTIMEZONE`, no `TZID`, no offset arithmetic, no DST edge cases at the BST boundary — the whole
  category of bug named in #818's brief evaporates rather than being solved.
- A dep abroad the week before sees the wall-clock time, which "re-floats" to the correct reading
  the moment they are back in the gig's zone. The failure mode is a dep permanently on a foreign
  device zone mis-planning travel — real, but narrow, and mitigated by the venue address and portal
  link that ride in the same event.
- It is unambiguously legal RFC 5545, which matters because new Outlook (2023+) is reported to
  enforce the spec strictly and silently drop fields from files older Outlook accepted.
  **[secondhand]**

### The flip trigger

Switch to form 3 (`TZID` + `VTIMEZONE`) **when the schema gains a real zone for the gig** — most
plausibly derived from the venue's `latitude`/`longitude`, which #829 already put in scope. That is
a strictly additive change to the generator, not a rewrite, so deferring costs nothing. Do **not**
switch by hardcoding `Europe/London`.

### Why this kills the library question

Both candidates were checked against the one hard part — `VTIMEZONE` — and **neither does it**:

| | `ics@3.12.0` | `ical-generator@11.1.0` |
| --- | --- | --- |
| Licence | ISC | MIT |
| Unpacked | 72 KB | 809 KB |
| Runtime deps | 3 — `nanoid`, `runes2`, `yup` (`yup` alone is 270 KB) | 0 |
| Last publish | 2026-04-23 | 2026-08-02 |
| `TZID` / `VTIMEZONE` | **Not supported at all.** Offers only `startOutputType: 'utc' \| 'local'` — UTC or floating | Accepts a `TZID` but **generates no `VTIMEZONE`**; the README points at `@touch4it/ical-timezones` or `timezones-ical-library` as a *second* package |

**[repo]** for the registry metadata (`npm view`), **[spec]** for the two READMEs.

So the choice is not "30 hand-rolled lines vs. a library that handles the hard case." It is "30
hand-rolled lines vs. a library that handles the *easy* case and hands the hard case back." For
floating time the libraries add string-escaping and folding — genuinely the fiddly bits, but ~15
lines of the 40 (see §5) and fully unit-testable.

**Recommendation: hand-roll. No `bun add`.** If the human prefers a library anyway, `ical-generator`
is the better pick — zero runtime deps, MIT, actively published — and `ics` should be rejected on
the `yup` transitive dependency alone.

---

## 5. What a hand-rolled generator actually has to get right

Not a lot, but each item is a real trap and each deserves a unit test.

- **CRLF, everywhere.** Lines end `\r\n`, not `\n`. **[spec]**
- **Fold at 75 octets.** *"Lines of text SHOULD NOT be longer than 75 octets, excluding the line
  break"*, folded by *"inserting a CRLF immediately followed by a single linear white-space
  character"* (§3.1). **[spec]** The trap is **octets, not characters** — a naive
  `slice(0, 75)` can split a multi-byte UTF-8 sequence and produce mojibake. Fold on a byte buffer,
  or fold conservatively at a lower character count.
- **`TEXT` escaping** (§3.3.11): `\` → `\\`, `;` → `\;`, `,` → `\,`, newline → `\n`. Colons are
  *not* escaped. **[spec]** Venue names and addresses routinely contain commas, so this is not
  theoretical.
- **Required properties.** `VCALENDAR` needs `PRODID` and `VERSION:2.0`. `VEVENT` needs `UID` and
  `DTSTAMP`; `DTSTART` is required when the object carries no `METHOD` **[spec]** — which is exactly
  our case (§6).
- **Property order.** If a `VALARM` is ever added, it must come *after* the event properties or new
  Outlook silently strips fields such as `LOCATION`. **[secondhand]** Easiest mitigation: don't ship
  a `VALARM` in v1.
- **Extract the calendar day in UTC.** Use `getUTCFullYear`/`getUTCMonth`/`getUTCDate`, matching the
  `timeZone: 'UTC'` precedent the digest already sets (`digest.service.ts:156,164`) **[repo]**. A
  local-time extraction silently slips the gig by a day on any server not running UTC — the exact bug
  the digest guards against.
- **Tolerate a `Booking.date` that isn't UTC midnight.** §3 establishes UTC-midnight as the
  *production* truth, but it is a convention of the write path, not an invariant: `prisma/seed.ts`
  writes zone-less `new Date('2026-09-12T14:00:00')`, parsed in the **server's** zone
  (`seed.ts:523` and siblings) **[repo]**. Preprod runs on seeded data, so that is precisely where
  this gets smoke-tested. Take only the UTC calendar day and discard the rest — never read a time of
  day off `Booking.date`.
- **All-day fallback.** When the booking has no set with a `startTime` — entirely possible, the field
  is nullable and free-text — emit `DTSTART;VALUE=DATE:20260915` rather than guessing a time. This
  keeps the attachment useful for an enquiry-stage gig, which is a real case since #817 established
  that "Choose a lineup" does not fold instantly on an enquiry.

---

## 6. `METHOD` and RSVP — omit it, and this is a correctness point not a preference

#819 ratified that confirmation is **portal-only, one-shot, with organiser-only reversals**.
`METHOD:REQUEST` would open a **second, competing confirmation channel**: it is what makes clients
render Accept/Decline, and in a full iTIP setup it mails an RSVP back to the `ORGANIZER` address —
which would land in the organiser's inbox and never touch `BookingBandMember.status`. Two sources of
truth for "did the dep accept", one of which the app cannot see.

RFC 5545 §3.7.2 blesses the alternative explicitly **[spec]**:

> *"If this property is not present in the iCalendar object, then a scheduling transaction MUST NOT
> be assumed."* Such an object merely *"transport[s] a snapshot of some calendar information;
> without the intention of conveying a scheduling semantic."*

That is precisely what we want: here is the gig, put it in your diary, answer on the portal.

It also fixes the MIME header, because the spec couples them: *"When used in a MIME message entity,
the value of this property MUST be the same as the Content-Type 'method' parameter value… If either
the METHOD property or the Content-Type 'method' parameter is specified, then the other MUST also be
specified."* **[spec]**

**⇒ `Content-Type: text/calendar; charset=utf-8` with no `method=` parameter, no `METHOD` property,
and therefore no `ORGANIZER`/`ATTENDEE` scheduling block.**

`METHOD:PUBLISH` is the other no-RSVP option and would also be defensible, but it is an iTIP
scheduling method and buys nothing over omission here.

### Honest limitation

Community reporting is consistent that no client *auto-adds* an attached `.ics` — Apple Mail
requires the recipient to open and accept; Gmail renders an inline card *sometimes*, described as
depending on file structure and sender reputation. **[secondhand]** The asset should not promise
"add to calendar" as a guaranteed affordance. Worst case it degrades to a downloadable file that
every calendar app on earth can open — still useful, and the portal link is the real destination
anyway.

---

## 7. `UID`, re-sends, and the one thing we cannot do

`UID` is *"the persistent, globally unique identifier for the calendar component"* and the
correlation key across revisions **[spec]**. Inconsistent `UID`s are the documented cause of
duplicate calendar entries **[secondhand]**.

This collides with a decision already on the map. **#819 ratified that re-invite = a fresh
`BookingBandMember` row + a fresh token.** So:

- **`UID` from the member row id** ⇒ a re-invited dep gets a **second** calendar event alongside the
  stale first one.
- **`UID` from `bookingId` + `contactId`** ⇒ a re-invite **updates** the existing entry. Correct, and
  stable across the row churn #819 designed in.

**Recommendation: `UID = <bookingId>.<contactId>@<APP_BASE_URL host>`**, and always stamp a fresh
`DTSTAMP`.

### Don't ship `SEQUENCE` — and this is why it costs no storage

The obvious companion to a stable `UID` is a `SEQUENCE` counter, and it is a trap here for two
reasons.

- **It has no meaning without `METHOD`.** RFC 5545 §3.8.7.4 defines it as *"monotonically incremented
  by the 'Organizer's' CUA each time the 'Organizer' makes a significant revision"*, and *"the
  'Organizer' includes this property in an iCalendar object that it sends to an 'Attendee' to specify
  the current version"* **[spec]** — an iTIP scheduling concept. §6 rules iTIP out. With no `METHOD`,
  a client treats the file as a snapshot and correlates on `UID` alone; `SEQUENCE` is decorative.
- **It has nowhere to live.** The `UID` is deliberately stable while #819 churns a **fresh
  `BookingBandMember` row per re-invite**, so a counter on the member row cannot carry it. Nor would
  a row count be a faithful substitute: #819's soft-removal keeps old rows, so
  `count(BookingBandMember where bookingId, contactId)` *is* monotonic and needs no column — but it
  counts *re-invites*, not *revisions*, and would miss the case `SEQUENCE` exists for (the gig time
  changed and the invite was re-sent to the same row).

**⇒ Omit `SEQUENCE` entirely** (its default is `0` **[spec]**). This is why §9's "no new column"
holds: the versioning question that would have demanded storage is dissolved rather than deferred.
If a later effort adopts iTIP — most likely the band-facing agreement #824 parked — `SEQUENCE` and
its storage arrive with it.

⚠️ **What we cannot do:** retracting a calendar entry requires `METHOD:CANCEL`, which is a
scheduling transaction — the thing §6 rules out. So when a dep is **removed** (#819's soft-removal),
their `/band/:token` link dies but **the calendar entry on their phone stays**. This is an accepted
limitation to state in the ADR, not a bug to design around; the mitigation is that the entry's
`URL` and `DESCRIPTION` point at a portal that now 404s.

Note the second-order effect of #824's decision that the invite email carries the *link* not the PDF
because "invite time is when details are least settled": the `.ics` is frozen at invite time too. A
stable `UID` is what makes a later re-send *correct that* rather than compound it — the `.ics` is
only "the right thing to freeze" *because* it is the one artifact that can be superseded in place.

---

## 8. Template variables — the real architectural finding

`band_invite` is **per-recipient**. Each dep needs their own `bandPortalToken` link, their own role
and call time. Three separate facts follow, and only the first is a non-issue.

**(a) The substitution engine is fine.** `renderTemplate(content, context)` is a pure function of a
context object, and `resolveVar` is a plain keyed lookup with a fallback catalogue
(`tiptap-substitute.ts:22-26`). **[repo]** Calling it N times with N contexts costs nothing and
breaks no ADR-0064 invariant. Widening `EmailContext` with optional band keys works with the
existing `VARIABLE_FALLBACKS: Partial<Record<string, string>>`.

**(b) The context builder is per-booking, by signature.** `buildContext(userId, bookingId, invoiceId?, …)`
returns a flat `EmailContext` and knows nothing about a recipient
(`mail.service.ts:96-134`). **[repo]** A band context is `buildContext(...)` **plus a per-member
overlay** — the shape wants deciding in #821, but the cheap and honest version is a second argument
carrying the member, not a fifth positional override.

**(c) The send path has no server-initiated fan-out — this is the gap.** Every email GigLoop sends
today is rendered for a **human compose sheet** and sent back:

- `GET …/communications/render?templateId=` renders **one** subject + body — the endpoint's own
  summary says *"returns subject and body for the compose sheet"* (`communications.controller.ts:42-58`).
  **[repo]**
- `POST …/communications/send` then takes `dto.subject` and `dto.body` **from the client**
  (`communications.controller.ts:82-100`). **[repo]**
- Even the invoice send, which attaches a server-generated PDF, takes its body from the client
  (`invoice-transition.service.ts:120-137`). **[repo]**
- The one server-rendered path, the digest, uses `sendBatch()` — **which cannot carry attachments**
  (§2). **[repo]**

So a band invite that (i) renders differently per dep and (ii) carries an `.ics` **cannot use either
existing shape**. It needs a service-owned loop calling `MailService.send()` once per member. That
in turn raises questions this ticket cannot answer alone — they are live design decisions, not
write-ups — so they are charted as
**[#842](https://github.com/thstanton/gigloop/issues/842)**, a grilling ticket blocking #821:

- Does the organiser get a compose sheet at all, and if so what do they see — one representative
  render with the per-dep bits shown as variables?
- One "invite the band" action or a per-row Invite? #817's per-person checklist steps pull one way,
  a leader filling five chairs at once pulls the other.
- Partial failure: 5 deps, send 3 succeeds and 4 fails. `sendEmail()` currently marks one
  `Communication` row per send and rethrows (`communications.service.ts:92-104`) **[repo]**, which
  is the right primitive, but the caller needs a policy: continue-and-report, or stop.
- One `Communication` row per dep (matching the existing per-send logging), or one per fan-out?
- #819's rule that "the invite email sets `INVITED` automatically" needs a per-member answer under
  partial failure — presumably only the members whose send succeeded.

---

## 9. Concrete consequences to hand on

**For [#823](https://github.com/thstanton/gigloop/issues/823) (schema, migration, one-schema-PR lock):**

- **No migration is needed for the template itself.** `TemplatesService.findAll()` seeds missing
  built-ins on read (`templates.service.ts:12-19`) **[repo]**, so adding `band_invite` to
  `BuiltInTemplateType` / `BUILT_IN_EMAIL_TYPES` / `TEMPLATE_DEFAULT_SUBJECTS` / `DEFAULTS` reaches
  existing users the next time they open Templates.
- ⚠️ **The trap:** `TemplatesRepository` has **no `findByBuiltInType`** — only `findOne(userId, id)`
  and `findAll(userId)` **[repo]**. A *server-initiated* band invite must look the template up by
  built-in type, and that lookup must route through the self-healing path (or seed on miss), or a
  user who has never opened the Templates page will have no `band_invite` row and the send will 404.
- ⚠️ **`DEFAULTS` is `Partial<Record<BuiltInTemplateType, …>>`** **[repo]** — a missing default *body*
  is not a type error and no spec catches it. Only the *subject* is covered
  (`mail.service.spec.ts:433,468`). Adding `band_invite` should come with a body-coverage assertion,
  or the vocabulary should be converted to the CLAUDE.md `as const satisfies` table with a
  compile-time coverage check while we are in there.
- **`.ics` needs no new column.** Everything it emits — date, wall-clock start, duration, venue,
  title, token — is already stored or is #823's existing business (chairs, tokens).
- The only new *shape* is on the mail seam, not the DB: `MailTransportOptions.attachments` gains an
  optional `contentType?: string`, passed through to Resend's `contentType`. One field, one line at
  `mail.service.ts:180`.

**For [#821](https://github.com/thstanton/gigloop/issues/821) (the ADR(s) and PRD):**

- Record the four `.ics` decisions as design constraints: floating time, no `METHOD`, `UID` from
  `bookingId`+`contactId`, no `SEQUENCE` — plus the stated limitation that a removed dep's calendar
  entry cannot be retracted.
- The **server-rendered fan-out** (§8c) is the largest piece of new machinery this email implies and
  it is invisible from the `.ics` framing. It is now
  [#842](https://github.com/thstanton/gigloop/issues/842), which blocks this ticket — write up its
  answer, don't invent one.
- Decide the `VEVENT` scope. **Recommendation: one event per dep**, `DTSTART` = their own earliest
  chair's derived call time, `DTEND` = the end of their last segment, with the whole-day running
  order in `DESCRIPTION`. This mirrors #826's "call times derived, never stored" and #824's shared
  sheet with a call-time *column* — the sheet is shared and forwardable, but the `.ics` rides on a
  per-member email and is not, so per-dep costs nothing and is more useful. If chairs are not
  settled when this is built, a single whole-day event is a clean fallback.
- Content should be #816's `BAND_PORTAL_FIELDS` roster projection, not an ad-hoc pick:
  `SUMMARY` from `Booking.title` (which #824 amended into the roster scope), `LOCATION` from venue
  name + address, `URL` + `DESCRIPTION` carrying the `/band/:token` link and organiser contact.
- Confirm the accepted limitation that clients do not auto-add, so the email copy must carry the
  portal link as the primary call to action and treat the attachment as a convenience.

---

## 10. Open questions for the human

1. **Approve "no new dependency"?** The recommendation is to hand-roll ~40 lines. The alternative is
   `bun add ical-generator` (MIT, zero runtime deps) — which would still not do `VTIMEZONE`, and
   would still need a second package if we ever move off floating time.
2. **Accept floating time**, i.e. accept that a dep whose device is on a foreign zone sees the
   wall-clock time rather than the converted one — in exchange for never hardcoding `Europe/London`?
3. **Accept that removal cannot retract a calendar entry** (§7), given that retraction requires the
   `METHOD:REQUEST`/`CANCEL` machinery that would also open a second confirmation channel?

---

## Sources

- [RFC 5545 — Internet Calendaring and Scheduling Core Object Specification (iCalendar)](https://www.rfc-editor.org/rfc/rfc5545.html) — §3.1 folding, §3.2.19 `TZID`/`VTIMEZONE`, §3.3.5 date-time forms, §3.3.11 `TEXT` escaping
- [RFC 5545 §3.7.2 — `METHOD`](https://icalendar.org/iCalendar-RFC-5545/3-7-2-method.html)
- [RFC 5545 §3.8.4.7 — `UID`](https://icalendar.org/iCalendar-RFC-5545/3-8-4-7-unique-identifier.html)
- [Resend — Send Email API reference (attachments)](https://resend.com/docs/api-reference/emails/send-email)
- [`ics` on GitHub (adamgibbons)](https://github.com/adamgibbons/ics) — timezone support
- [`ical-generator` on GitHub (sebbo2002)](https://github.com/sebbo2002/ical-generator) — `VTIMEZONE` via an external package
- [Add to Calendar PRO — ICS file generation for email](https://add-to-calendar-pro.com/articles/ics-file-generation-for-email-marketing-453efa1d) — **[secondhand]** client behaviour, new Outlook strictness, property ordering
- Registry metadata via `npm view ics|ical-generator|yup` on 2026-08-18
- This repository at `d2df9c1`
