# ADR-0066: The People/Venue atoms edit the assigned contact in place; "assignment only" is reversed

- **Status:** Accepted
- **Date:** 2026-07-20
- **Reverses:** the "assignment only" scope established by `c3a7c5e` (People atom) and `539bb81` (Venue atom)
- **Related:** ADR-0053 (New Booking converges on the Builder atoms — the create-mode boundary this ADR must not cross), ADR-0023 (container/presentational split), ADR-0047 (atomic booking creation), ADR-0057 (goal ⊃ step checklist — the `add_email` precondition), PRD #511 (Booking Builder)
- **Tracking:** #762

## Context

From a booking, a musician could **re-assign** which contact filled a role — never amend the contact already there. There was no path to edit a contact's details without navigating out to `/admin/contacts/:id`.

That gap has a sharp edge. The deposit and contract goals carry a PRECONDITION step *"Add the client's email"* (#618). Its shortcut (`checklistShortcuts.tsx` → `add_email`) deep-links to the Booking Builder's **People** section, which offers only *Select existing* / *+ New*. The checklist tells the musician to add an email and then sends them somewhere they cannot add one. The shortcut is correct; the destination was missing the capability.

How it got that way: `c3a7c5e` introduced `PeopleAtom` as assignment-only and deleted the per-contact `Edit` triggers from `PersonCard`/`PersonChip` — its message reads *"assignment only (detail edits stay in the contact editor)"*. `539bb81` did the same for venue. Both left `ContactEditSheet` — a complete in-booking contact editor — still **mounted** in `BookingDetailSheets` but with **no writer**: a whole-tree grep for `contactEdit` returned only the read site. It had been unreachable ever since, along with its "Remove venue from booking" footer.

Two facts constrain the fix:

1. **The Builder exists to remove sheet-stacking.** PRD #511 / ADR-0053 replaced a sheet-heavy editing UX with flat, in-place sections. Answering a Builder gap by opening a sheet on top of the Builder fights the thing the Builder is for.
2. **The API side is already correct.** `contacts.service.ts` re-evaluates the checklist of every booking a contact is customer of when `dto.email` changes (#618, via the ADR-0062 seam). A contact `PATCH` already resolves the precondition server-side. Only the client was missing.

## Decision

**Inside a booking, the People and Venue sections are *inline-edit-primary*: an assigned contact is edited in place, and re-assignment is the secondary action.**

The "assignment only" scope mismodelled the section. Assignment happens at booking creation; a booking's customer is very unlikely to change mid-lifecycle. The tabbed *Select existing / + New* shape optimised for the rare act and made the common one impossible.

1. **The mode switch lives in the atom, not in the field cores.** `PeopleAtom`/`VenueAtom` render *either* an `AssignedContactCardContainer` (a contact is assigned) *or* today's `RoleField`/`VenueFields` (assign mode). `RoleField` and `VenueFields` are **unchanged** and remain pure, assign-mode-only presentational cores.

   This is load-bearing, not incidental: `BookingFormFields` composes `RoleField`/`VenueFields` **directly**, so the New Booking create path never sees the new card. The create-mode exclusion falls out of the structure rather than depending on a flag someone can forget to pass.

2. **Create mode is deliberately excluded.** In New Booking, assignment genuinely *is* the job — nothing is chosen yet. And the create form's save is a single atomic booking `POST` (ADR-0047); a contact `PATCH` firing from inside it would be a second, non-atomic write that could succeed while the booking creation fails, leaving a mutated contact and no booking.

3. **Reuse the canonical `ContactForm`; do not declare contact fields a third time.** `ContactForm` is react-hook-form + Zod with real validation — including `email: z.string().email(...)`, which matters most precisely here, since the whole defect is *the email*. `RoleField`/`VenueFields` already hand-roll an unvalidated second copy of the contact fields; a third would be worse. `ContactForm` gains an *embedded* presentation (no Contact Type select; Name/Greeting/Email/Phone visible, the rest folded behind the existing disclosure idiom; venue keeps its address visible because for a venue the address is the identity) and a `saved` state.

4. **Every card owns its own Save; the section-level Save row is dissolved.** `PeopleAtom`'s shared Save row was section-scoped, while a contact edit is card-scoped. Keeping both would put two Saves of different scope on screen with nothing to distinguish what each covers — a section-level Save that silently does not cover a box's edit. Instead each card has exactly one Save at all times: "Save contact" in edit mode, the assignment Save in assign mode. A button's scope is inferable from the box it sits in.

5. **The contact save is Tier 1 in every shell.** Inline `Saving…` → `Saved`; the card stays in edit mode and, inside the quick-tweak sheet, the sheet does **not** close. Amending a field is CLAUDE.md's Tier-1 case, and closing the sheet after fixing an email would force a reopen to check the phone number. The *assignment* save keeps its existing per-shell behaviour (Tier 1 in the Builder, Tier 2 close-on-success in the quick-tweak sheet).

6. **Changing contact with unsaved edits confirms first.** Dirty + "Change …" becomes an inline two-step ("Discard changes and pick someone else?"), reusing the inline-confirm idiom rather than a Dialog. Silently discarding would lose the edit in exactly the flow this ADR exists to serve.

7. **`ContactEditSheet` is retired.** It is unreachable, and the new card supersedes it. "Remove venue from booking" survives as clear-then-Save via `ContactPicker`'s existing clear control. `ContactEditDrawer` (the contact *page*'s editor) is untouched — consolidating the two is separate work.

## Consequences

- **`PeopleAtom`/`VenueAtom` are no longer mutation-free.** They compose a container. The "Sheet-agnostic, owns no mutation" framing in their doc comments is corrected by this ADR's implementation; `PeopleFields`/`VenueFields` keep theirs, narrowed to "assign-mode core", which is now a structural guarantee rather than a description.
- **"One atom, three shells" narrows for the edit path.** The Builder and the quick-tweak sheets get inline contact editing; the create form deliberately does not. The atoms still serve all three shells for *assignment*.
- The contact `PATCH` and its cache invalidation are declared **once**, in the container, for all three roles and both shells. The invalidation must include `['booking']` (TanStack prefix-matches, so no `bookingId` is needed) — without it the checklist keeps nagging until a reload even though the server has already resolved the precondition, and the fix reads as broken.
- A new container inside components that carry Storybook coverage: run the full unit project, not only stories (an embedded container has broken a unit spec while its story passed).
- **Not addressed here:** the pre-existing near-verbatim duplication of People/Venue save orchestration between `BookingBuilderPage` and the quick-tweak sheets; the `ContactEditDrawer` / `ContactEditSheet` duplication (resolved only by deletion, not consolidation); back-state threading on the venue map widget's contact link.
- **Reversibility:** the mode switch is a branch in two atoms. Reverting to assignment-only is deleting the card, its container and that branch — the field cores never changed.

## Alternatives considered

- **Re-wire the orphaned `ContactEditSheet`** (restore the `Edit` trigger on `PersonCard`/`PersonChip`). Rejected: it fixes booking *detail* but not the `add_email` shortcut, which lands in the Builder — the Builder mounts no such sheet. It also keeps a second, sheet-shaped contact editor alive to drift against the first.
- **Open a sheet from the Builder's People section.** Rejected on PRD #511 / ADR-0053 grounds: the Builder replaced sheet-stacking; a sheet over the Builder (and, in the detail shell, a sheet over a sheet) reintroduces what it removed.
- **Link out to `/admin/contacts/:id` with return state.** Least code, and the contact page is the canonical editor — but it throws the musician out of the Builder mid-task, which is the complaint. Kept as the *fallback* path, and its back-navigation bug is fixed alongside (#767).
- **A third "Edit" tab in `RoleField`.** Rejected: presents assignment and amendment as peers, which is the mismodelling being corrected — one is the job, two are exits. It would also drag a contact mutation into a presentational core and deepen the unvalidated duplicate of the contact fields.
- **Extend `PeopleSelection` with an `edit` variant, saved by the shared Save row.** Rejected once `ContactForm` was chosen: the form brings its own submit, and one Save per card is what makes each button's scope legible.
