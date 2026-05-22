# Drawer pattern for edit flows; action buttons for lifecycle events

Edit flows (changing booking or contact data) use a right-side Sheet (shadcn `Sheet`) rather than a separate full-page route. The sheet is URL-driven via a `?edit=true` query param on the detail page — the back button closes it, and it survives a hard refresh. On mobile it renders full-screen.

Separate full-page edit routes (e.g. `/bookings/:id/edit`) are not used and should not be created. The detail page owns the `?edit=true` param and renders the sheet conditionally.

This decision distinguishes two categories of user action:

**Edit** — the musician is changing data about the booking (fee, title, date, event type, venue, sets, notes, contacts). These live in the drawer. One explicit Save button commits all changes at once.

**Lifecycle action** — the musician is recording that the booking has advanced its expected state. These are not edits; they belong as dedicated action buttons directly on the detail page:
- Status transitions: the status pill on the detail page is tappable (popover/dropdown)
- Contract signed: a "Mark contract signed" action button
- Deposit received: a "Mark deposit received" action button

Mixing lifecycle actions into the edit drawer was rejected because it obscures the distinction between "something changed" and "something happened."

The same drawer pattern applies to Contact editing. New-entity forms (e.g. `/bookings/new`) remain as full-page routes — the drawer is for editing existing records only.

**Exception — Songs (Repertoire):** Songs are simple enough (title, artist, genre — 3 fields) that a drawer is disproportionate. The Repertoire page uses fully inline editing: tapping a song row expands it into an editable form in place. New songs are added via an inline form row at the top of the list (not a separate page or drawer). The inline pattern was chosen specifically because musicians add multiple songs in one session and minimising interaction steps matters more than consistency with the drawer pattern.

Form components are shared between the new-entity form and the edit drawer to prevent divergence.
