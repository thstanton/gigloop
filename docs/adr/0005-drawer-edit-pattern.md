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

**Exception — Notes:** The booking notes field uses inline auto-save (no explicit Save button). Notes are scratchpad-style — the musician jots things mid-flow and should not need to commit deliberately.

**Inline auto-save vs. explicit Save:** the default is explicit Save. Inline auto-save is a permitted exception only when both conditions hold:

1. **Isolated** — it is the only inline-editable element on the page or section. No other field on the same view uses an explicit Save button.
2. **Justified** — there is a specific reason auto-save reduces friction: bulk-entry sessions (adding many songs), scratchpad behaviour (notes), or similarly session-oriented input.

**Never mix the two in the same edit component or page.** A section that auto-saves while a neighbouring section requires an explicit Save button will always confuse users — there is no visual treatment that reliably communicates the distinction. If either condition cannot be met, use explicit Save.

Current accepted inline auto-save exceptions: Notes (booking detail), Songs (Repertoire page). All other contexts use explicit Save.

**Sheet lifecycle:** two rules apply uniformly across all edit sheets:

1. **Save → auto-close.** On successful save, the sheet closes automatically. The musician should never need to manually dismiss a sheet after saving.
2. **Close with unsaved changes → discard silently.** Closing a sheet (back button, ✕, or navigation) discards in-progress edits without a confirmation prompt. Edit drawers are low-stakes — the data is always recoverable by reopening — and a "are you sure?" dialog adds friction without meaningful protection.

Any sheet that stays open after a successful save, or that prompts before discarding, is a deviation from this pattern.

Form components are shared between the new-entity form and the edit drawer to prevent divergence.

**Exception — Templates:** Template editing uses a full-page route (`/admin/templates/:id/edit`) rather than a drawer. A rich text editor (Tiptap) needs horizontal space that a drawer cannot provide. All 7 email templates share the same full-page editor.
