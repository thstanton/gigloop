# Invoice creation is draft-explicit; Issue is the single committing verb

**Status:** accepted — refines the invoice [[BookingChecklist]] action UX shipped in #585 (tracking #583); reverses #585's auto-create mechanic on the same branch. Implemented by #598.

The create-invoice flow had drifted into two *separate* sheets with different verbs for the same committing act: the create-mode sheet's primary button said **"Create invoice"** but actually create+issued (locking immediately after a confirm), while the draft-edit sheet added in #585 said **"Issue invoice"**. Worse, the checklist "Create deposit/balance invoice" action reached these inconsistently — when fee + deposit% were both set it **silently auto-created a draft** and opened the edit sheet; otherwise it opened the create sheet. So the same checklist tap landed in different sheets, "Create invoice" secretly meant "lock," and a draft could come into existence before the user committed to anything. The issue-confirmation was also a raw bottom `Sheet`, so it rendered as a bottom sheet on desktop too.

**Decision:**

1. **One verb everywhere.** Both the create sheet and the draft-edit sheet present **Issue invoice** (primary, with helper text: *"Generates the PDF ready to send to your client. You won't be able to edit it after it's issued."*) and **Save draft** (secondary). The "Create invoice" button label is retired — **Issue** is the single committing verb. One confirmation wording: *"Issue and lock this invoice?"*.

2. **A draft is born only from an explicit click.** The checklist invoice action opens the **Create sheet** (nothing persisted); a draft exists only after **Save draft** or **Issue**. The auto-create-then-open-edit path (and its cache-seed) is removed. Abandon the sheet → nothing persists, the checklist item stays pending. The shortcut is **draft-aware**: a non-void DRAFT of that type → open *it* to issue; an ISSUED/SENT/PAID one → "void it first" toast; none → Create sheet, prefilled with the computed amount when fee + deposit% are set.

3. **The checklist milestone is *issued*, not *drafted*.** `create_deposit_invoice` / `create_balance_invoice` already complete only when the invoice is **Issued** (a DRAFT is a scratchpad and never ticks the box — `checklist.repository.ts` excludes DRAFT from `invoiceExists`). This is kept; only the **labels** are renamed to **"Issue deposit/balance invoice"** so label = completion = button verb (keys stay `create_*` internally).

4. **The issue-confirmation uses `ResponsiveDialog`** (ADR-0012) — centred dialog on desktop, bottom sheet on mobile — instead of a raw bottom `Sheet`.

**Considered and rejected / deferred:**

- **Auto-create-then-open-edit (#585's initial mechanic):** rejected — it manufactures silent drafts (orphaned if the user backs out) and split the UX into two sheets. Draft-explicit creation is the fix.
- **Two checklist items — `create` (draft) + `issue` (issued) — promoting the saved draft to a visible milestone:** genuinely cleaner in isolation (it makes the "drafted but not issued" state legible and mirrors the existing `create_contract`/`send_contract` split), but doing granularity *well* needs a general **sub-step / subtask type** so we don't either overwhelm the per-concern reminder toggle (ADR-0052) or have to handle every broken dependency chain on deselection. **Deferred to its own grill (#597).** The single issue-gated item + draft-aware shortcut is the pragmatic now-fix.

**Consequence:** this deliberately reverses the auto-create mechanic shipped in #585 an hour earlier on the same branch — a future reader comparing the two commits has the why here. `send_balance_invoice` (#586) already depends on `create_balance_invoice`, which completes on *issued*, so the send step correctly stays gated on issuance — no change.
