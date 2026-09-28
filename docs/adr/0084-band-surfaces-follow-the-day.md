# ADR-0084 — The band surfaces follow the day

## Status
Accepted (2026-09-28). Decided via `/grill-with-docs` on #1052 (band workflow polish), with a design canvas as the reference. **Amends ADR-0072 §6, ADR-0073 §2, §4 and §7, and ADR-0074 §2 and §5** as set out below. The user-facing vocabulary it relies on lives in `CONTEXT.md` (*the day is the spine* and *user-facing band vocabulary*), not here.

## Context
The band feature shipped across ADR-0072, ADR-0073, ADR-0074 and ADR-0081 with a correct model: a Lineup per group of people, a Chair per part, one member row per person. But the surfaces exposed that model almost directly. The booking showed three names for a group of people (Lineup, "Band", the Band card) and no user-facing noun for the thing a lineup plays. The edit sheet mixed structure (who fills which part) with relationship actions (invite, call sheet, final details, portal preview) on every person row. The call sheet deliberately omitted the logistics a player needs on the day. And the portal showed every assigned name, including people who had only been asked or had already declined. #1052 collected the symptoms. The cause was that there was no agreed answer to *what does the musician hold in their head first?*

## Decision

### 1. The day is the spine
A musician holds a gig as its day ("solo ceremony, trio for drinks, five-piece in the evening"), so band information hangs off the booking's packages, and the only band-first view is the people list. The model is unchanged. This decision governs presentation only.

### 2. Four surfaces, re-divided (amends ADR-0072 §6)
- **Itinerary card:** under each package, its lineup and how many parts are still to fill ("Evening · 5-piece · 1 still to fill"), then its parts.
- **Players card** (formerly the Band card): the people list, grouped by answer. It carries the per-player actions (invite, portal preview, fee, change answer, "Take off this gig") and the band-wide sends.
- **Band sheet / Builder Band section:** structure only, one block per package (a lineup picker, then parts). It has no invitations, messages or statuses. A lineup playing two packages appears in each, marked "also plays …". The picker changes **only its own package**: it links a lineup already on the booking, applies a template, or leaves the package on "Decide later". It warns before a change leaves a confirmed player with no part. A booking with no packages has one block, "The gig". A lineup linked to no package sits in a "Not playing anything yet" block.
- A part row has one primary action (assign or change the player) and a `⋯` menu (Empty, Rename, Remove part). Reorder is "Order parts…" on the package block's `⋯`, which resolves #1022 with its option 2.

### 3. Names cross only once confirmed (amends ADR-0073 §2)
ADR-0073 §2 made showing every name to every player a **conscious exposure**. This decision reverses it. The portal and the call sheet show another player's name **only once they are `CONFIRMED`**. Any other part shows its role alone, marked "tbc". Showing a name reveals *who was asked*, which is a status by another route. Statuses themselves still never cross. A player reads their own answer as a sentence, never as a "Status" field.

### 4. The call sheet is the gig sheet on paper (amends ADR-0073 §4)
The rule is: *if the portal shows it to every player, the call sheet prints it*. So the call sheet gains the band-shared logistics and the venue's parking and access (the `logistics: null` special case goes), plus the same full running order as the portal. **Arrival, soundcheck and finish stay generic whole-booking anchors**, shown to everyone on both surfaces and attributed to no package. A player's derived time reads **"First playing at …"**, never "call time", because to a musician a call time means *be here by*, which GigLoop doesn't model per player. Arrival times per lineup or per package can be added later if they turn out to be needed.

### 5. What crosses to the band portal (amends ADR-0073 §2)
- **Venue parking and access info now cross.** ADR-0073 §2 kept them as private CRM fields. They are exactly what a player opens the map for, and making the organiser re-type them per booking was the gap #1052 reported. The crossing is made visible with the indicator (§6). The portal shows the venue as its address, a map (the shared venue map, without travel time) and an "Open in Maps" link.
- **Band-shared logistics:** each built-in field stays fixed as band-facing or not (dress code is not; `outfits` is). Only a **custom** field carries a per-entry "share with band" choice, which defaults to off. This gives the dormant per-entry `shareWithBand` flag its only UI.
- The **`self` scope** gains a calendar download, reusing ADR-0074 §4's `.ics` (same UID). It runs from the first-playing time to the finish, or to the end of the player's last set if there is no finish time.

### 6. A "Visible on Band Portal" indicator (amends ADR-0073 §7)
ADR-0073 §7 put no badge on logistics fields because the toggle was the signal. That signal doesn't exist for built-in fields, which have no toggle, so the musician couldn't tell what their players see. A **"Visible on Band Portal"** indicator now follows the client-portal indicator pattern: it's a passive mirror of the same `audience: BAND` authority, and it's a separate axis from the client indicator. It appears on each Details row (next to the client indicator, in compact form), on the Itinerary card and on the Venue card. With nobody on the gig it reads "Not visible — no players yet".

### 7. The organiser's own row
Seating the account owner makes their row `CONFIRMED` immediately (the `ADDED → CONFIRMED` transition is already legal). It has no status control, no fee, no send actions, and never counts toward "still to fill" or "waiting on".

### 8. Band-wide sends — compose once, send each (amends ADR-0074 §2 in the UI only)
The call sheet and final details are sent from the Players card: one compose sheet, pre-addressed to every confirmed player, with the option to untick people. On confirm, the **client** makes one existing per-person send per recipient. Each still logs its own `Communication` and flips only its own player. The result reports each player separately ("Sent to Ana and Ben · failed for Priya — retry"). **The server contract of ADR-0074 §2 is unchanged**: there is still no server-side fan-out, so no partial-failure policy and no ambiguity about which player's status changed. Only the tapping is batched. The invitation stays per player, because each player has their own portal link.

Rejected: a server-side fan-out endpoint (it reopens every problem §2 removed), and per-person sending only (five players meant five taps).

### 9. Checklist labels (amends ADR-0074 §5)
The goal keys stay as they are. The labels follow the vocabulary: "Fill every part" (was "Fill every chair") and "Get the players confirmed". A per-person step's shortcut opens that player's action on the Players card, not the Band sheet.

## Considered and rejected
- **Band-first (people are the spine).** This is how the Band sheet was built. It forced the musician to count lineups and read a package suffix on every part.
- **Hide arrival and soundcheck from players who start later, or label them "for Ceremony".** Hiding made the portal and call sheet disagree. Labelling assumed the anchors belong to the first package, which isn't known.
- **A new booking-side noun for the unit a lineup plays ("section", "segment").** "Package" stays the fallback noun, and a package is otherwise named by its label.
- **Showing every assigned name (ADR-0073 §2 as it was).** Rejected per §3.

## Consequences
- The band portal projection becomes filtered by status. The mapper needs each member's status to decide whether their name crosses, but the status itself must still never reach the output. The shape spec should pin that.
- The Players card and the Band sheet split `BandAtom`'s current responsibilities. The Builder's Band section composes only the structural half.
- Venue CRM fields crossing to the band sets a precedent: any future venue field that crosses needs its own row in `BAND_PORTAL_FIELDS` and an indicator.
- #1052 is superseded by two sequential tracking issues planned from this ADR and the canvas: #1053 (the musician's side), then #1054 (what crosses to players). #882 finishes first on its own branch, using §9's labels.
