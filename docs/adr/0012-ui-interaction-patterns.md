# ADR-0012 — UI Interaction Patterns

## Status
Accepted

## Context

As the booking detail page grew in density (checklist, finance, communications, people, venue, performance, music form), a set of recurring interaction problems emerged:

- Action buttons (`Button variant="outline" size="sm"`) in card headers made headers taller than those of read-only cards, creating visual inconsistency across the right panel.
- Whole-row and whole-card links (wrapping everything in `<Link>`) made email/phone anchors unreachable without `stopPropagation` hacks.
- Section headers within cards used inconsistent type treatment — some with `font-medium`, some without; some with icons, some without — making it hard to scan hierarchy at a glance.
- Status badges were right-aligned in some list contexts, so the 3px left-border accent appeared at different horizontal positions across rows, losing its visual rhythm.

## Decision

### Contextual action buttons

Actions that live in card or section headers — Edit, Add invoice, Send email — use a text link style, not a `Button` component:

```tsx
<button type="button" className="text-xs text-primary hover:text-primary/80 transition-colors">
  Edit
</button>
```

When an icon adds meaningful context, include it at size 12 with `inline-flex items-center gap-1`:

```tsx
<button type="button" className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
  <Plus size={12} />
  Add invoice
</button>
```

These actions sit at the right end of the card title row via `flex items-center justify-between`. They never increase the row height.

### Card section headers — two levels

**Card title** (the `Card` component's `title` prop): `text-xs font-medium text-muted uppercase tracking-wide`. Identifies the card type. Rendered by the shared `Card` shell component and must not be overridden.

**Named subsection header** (within a card): an icon + medium-weight label at body scale:

```tsx
<div className="flex items-center gap-1.5 text-sm font-medium text-foreground mb-1">
  <SomeIcon size={14} />
  Section name
</div>
```

Used for performance formats, music form key moment sections, and venue detail sections (Parking, Access, Equipment). The icon must be contextually meaningful — not decorative. If no meaningful icon exists, fall back to the card title style rather than using a placeholder.

### Status badge alignment in vertical lists

Status badges (`BookingStatusPill`, `InvoiceStatusPill`) must be **left-aligned** in any context where they repeat vertically. Place them below the item title in the left content column, not at the right end of the row.

Correct:
```tsx
<div className="flex-1 min-w-0">
  <p className="text-sm font-medium">{title}</p>
  <p className="text-xs text-muted">{meta}</p>
  <div className="mt-1"><BookingStatusPill status={status} /></div>
</div>
```

Incorrect (badge pushed right):
```tsx
<div className="flex items-center justify-between">
  <span>{title}</span>
  <BookingStatusPill status={status} />  {/* ← left border at different x each row */}
</div>
```

The 3px left border is a visual rhythm element — it only works when the borders stack at the same horizontal position.

### Contact link pattern

Only the contact name (plus a `ChevronRight` size 14) is a navigable link. The surrounding row, card, or email/phone anchors are never wrapped in the same link.

```tsx
<div className="py-4 border-b border-border last:border-0">
  <p className="text-xs font-medium text-muted uppercase tracking-wide mb-1.5">{role}</p>
  <Link to={`/admin/contacts/${id}`} className="inline-flex items-center gap-1 group">
    <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
      {name}
    </span>
    <ChevronRight size={14} className="text-muted group-hover:text-primary transition-colors" />
  </Link>
  {/* email, phone, commission — plain anchors or text, not wrapped in Link */}
</div>
```

This applies to both `PersonCard` (customer, referrer) and `VenueCard` on the booking detail page, and to the bookings list on the contact detail page.

### Responsive confirmation dialogs

Confirmation and short quick-action popups render as a **centered `Dialog` on desktop** and a **bottom `Sheet` on mobile**, switched at the `md` (768px) breakpoint. Use the shared `ResponsiveDialog` wrapper (`components/ui/responsive-dialog.tsx`).

The switch is **pure CSS** — no JS viewport detection. `Dialog` and `Sheet` are both built on `@radix-ui/react-dialog`, so the only thing that differs between them is the Content element's position/animation classes. `ResponsiveDialog` renders a single Radix instance whose Content carries the mobile bottom-sheet layout as its base and `md:` variants for the centered-dialog layout. One instance means one focus scope, one scroll-lock, aria auto-wired, and no first-render flash. (The `useMediaQuery`/hook pattern common in the ecosystem exists because mobile drawers are usually a *different* primitive — e.g. vaul with drag gestures — forcing a component swap. That does not apply here, so no hook is warranted.)

```tsx
<ResponsiveDialog open={open} onOpenChange={onOpenChange}>
  <ResponsiveDialogContent>
    <ResponsiveDialogHeader>
      <ResponsiveDialogTitle>Mark as sent</ResponsiveDialogTitle>
    </ResponsiveDialogHeader>
    {/* …confirm/cancel actions… */}
  </ResponsiveDialogContent>
</ResponsiveDialog>
```

**Scope boundary:** `ResponsiveDialog` is for **confirmations and short quick-actions only** (ready/celebration prompt, outstanding-checklist warning, customer-mismatch warning, add-to-series, mark-as-sent, destructive-action confirm). Data-entry surfaces (contact creation, venue add, and other forms) go inline or to right-side Sheets per ADR-0005 — never `ResponsiveDialog`.

`RowActions` is the deliberate exception: its mobile and desktop affordances are already CSS-gated (`md:hidden` action sheet vs `hidden md:flex` dropdown), so its desktop confirmation is a plain `Dialog` (it only ever opens on desktop) and its mobile flow stays an inline `Sheet` body — no `ResponsiveDialog` needed.

> **Amendment (2026-06-18):** This section supersedes the unconditional `Sheet side="bottom"` introduced in commit `9240238`, which rendered confirmation popups as bottom sheets on desktop too (issue #470).

## Alternatives considered

- **`Button variant="outline" size="sm"` for card actions:** Rejected — inflates header row height, adds visual weight disproportionate to the action's frequency and importance. Edit, Add, Send are secondary to reading the content.
- **Whole-card `<Link>` for contact rows:** Rejected — email and phone anchors require `stopPropagation` to work, which is a leaky abstraction. The name+chevron pattern makes the navigable target explicit without hacking event bubbling.
- **Right-aligned status badges:** Rejected — the left-border accent loses its meaning when it appears at different x-positions across rows. Left-alignment under the item title is the only pattern that preserves the visual rhythm.

### Back navigation

Back links are always positioned **top-left** and always navigate **contextually** — to the page the user came from, not a hardcoded parent route. Use `useNavigate(-1)` or carry the origin as a `?from=` search param rather than hard-coding a destination path.

The preview banner back link (portal preview mode) follows the same rule: it reads from the `?from=` param set at the call site and sits top-left in the banner.

Never use a "back" affordance that navigates to a fixed route — if the same page is reachable from multiple places, a fixed destination will be wrong half the time.

### Empty-card pattern

When a card's content entity does not yet exist (no contract, no invoices, no documents), the card renders:

1. **Inline muted text** in the card body: `"None created"` at `text-sm text-muted`
2. **Contextual create action** in the card header (same `text-xs text-primary` text-link style as all other card actions)

No button in the card body. No illustration or icon. Full-page empty-state treatment (icon + heading + CTA) is reserved for page-level empty states (e.g. no bookings yet), never card-level.

The corresponding [[BookingChecklistItem]] for the creation step must carry a matching `shortcutAction` so the checklist item and the card header action point to the same trigger. A card that shows "None created" without a checklist shortcut is incomplete.

## Consequences

- The `Card` component's `action` prop is the standard hook for card-level contextual actions. Components must not add their own header structure outside of it.
- Any new list view that shows status badges must default to the left-aligned pattern. Right-aligning badges is a deliberate exception requiring justification.
- `ContactEditSheet` (a controlled version of `ContactEditDrawer` without delete) is the standard way to edit a contact from a non-contact page. It invalidates both `['contact', id]` and `['booking']` queries on save.
- Cards whose content entity may not exist must follow the empty-card pattern above. A button in the card body is never the create trigger — the card header action is.
