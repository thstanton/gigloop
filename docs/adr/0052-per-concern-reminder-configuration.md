# Reminder configuration distributed per concern (Smart Reminders)

**Status:** accepted — supersedes the reminder-control decision recorded during the Booking Builder step-sequence grill (PRD #511).

A booking's [[BookingChecklist]] could be configured in only two places: the musician's global template (Settings → Checklist, affecting future bookings) and a per-booking customisation **step in the New Booking wizard**. There was *no* way to opt out of a reminder once a booking existed — the post-creation API was add-and-tick only. UAT showed the wizard's standalone checklist step confused musicians (configuring a 12-item list mid-creation, before the booking is concrete), and the wizard and the [[Booking Builder]] had not converged. Underlying all of it: the checklist *straddles both hats* — it is mostly the CRM/deal spine (quote → contract → deposit → invoices → thank-you), with only a few operational (PM) items — so it never sat cleanly on the concern-organised Builder.

The reframe that unlocked this: from the musician's point of view the checklist is simply their **todo list**; the reminder *automation* (auto-complete + the surfacing that feeds the digest and Dashboard Actions) is a property of the **Booking**, not a list they consciously "configure". So we should never present a checklist-configuration screen — we should offer "we'll remind you about this" *in the section where the work lives*, at the moment the musician is thinking about it.

**Decision:** reminder configuration is **distributed per concern**, not centralised. Each concern (in the Builder and the new-booking form) carries a **"Remind me about"** control. There is no standalone checklist-config surface.

1. **Smart Reminder vs custom item.** A **Smart Reminder** is a system-authored [[BookingChecklistItem]] (has a `key`) that GigMan **auto-completes** and may **sequence** behind other items — capabilities only the system can author. A **custom item** (no `key`) is free-authored but inert (never auto-completes, never sequenced). The line is auto-completion + sequencing, *not* concern-mapping or staging (both of which a custom item may also carry). "Smart Reminder" is an internal term for now; surfacing it to musicians is deferred.

2. **Concern mapping.** Each reminder maps to the concern whose work it is about: Venue → `add_venue`, Itinerary → `build_itinerary`, Music → `song_requests`. Reminders with no natural concern fall to **Overview** (the deal/billing spine and the gig itself) or **People** (the outbound *sends* — quote, contract, music-form-invite, thank-you). The sends → People grouping ("things sent to a person") was chosen over keeping each create/send pair whole under Overview; it deliberately overloads the People concern (defined as customer + agent) and fractures three `dependsOn` chains across sections, accepted because (a) the todo list itself stays workflow-ordered on the Checklist card regardless of which section toggled an item, and (b) the chain-fracture is rendered harmless by point 5. The eventual cleaner home for the sends is the Communications record card (see deferred). Overview consequently owns the bulk of the deal spine — it is a deliberate catch-all, coherent because Overview *is* the deal-level concern.

3. **Opt-out = user SKIP.** Being on the todo list *is* being reminded; there is no task that is present yet un-reminded. Turning a reminder off removes it via a user-initiated `SKIPPED` (reversible) — the post-creation equivalent of un-seeding it in the wizard.

4. **Contents + on-demand seeding.** The control lists every reminder applicable to the concern whose stage the booking has **not yet passed**, minus any the musician disabled globally, each toggled on/off. Restricting to current-and-future stages disambiguates an OFF reminder (a current/future one was opted out and is re-enableable; a past one was system-retired as the booking advanced and is simply not shown) — so the reused `SKIPPED` state needs no "skip reason". Turning *on* a reminder that has no record yet (a newly added reminder type, or one re-enabled after a global disable) **seeds it on demand** from the defaults. This **relaxes the prior "seeded exactly once at creation" invariant** — items can now be born post-creation.

5. **Evaluator blocking-semantics change.** The dependency-blocking test treats a dep as satisfied when it is **COMPLETE, SKIPPED, or absent** (previously: only COMPLETE). Without this, opting out a mid-chain reminder post-creation would strand its downstream items in BLOCKED forever (a SKIPPED dep can never become COMPLETE). This is also strictly more robust than the status quo, which avoids the absent-dep bug only by luck of seed-time `dependsOn` stripping.

6. **New `concern` field; custom items concern-mappable.** A nullable `concern` is added to checklist items and the template. System reminders resolve their concern from a static map; custom items carry a user-chosen concern. A concern-mapped custom item appears in that concern's control (and can be created from it) — this is what finally gives a musician's **global** custom reminders a home in the per-concern surface. A concern-less custom item stays on the Checklist card as a plain todo. The global Settings template remains the master switch (what is ever offered/seeded); the per-concern control is the per-booking override; the Checklist card remains the unified todo *view* and the home for concern-less custom authoring.

**Supersedes:** the step-sequence grill's reminder-control decision (*opt-out only · only on the applicable steps Itinerary/Venue/Band · disable seeded default only, not custom authoring*). This grill overturned all three axes deliberately: every concern (not three), opt-in discovery as well as opt-out, and custom authoring in scope (concern-mappable customs). A future reader finding the old rule in earlier notes should treat it as replaced by this ADR.

**Considered and rejected:** a single post-creation config home on the Checklist card (handles all items, one mental model — rejected because it keeps a "configure your checklist" screen the reframe is trying to dissolve, and forgoes the in-context discoverability that is the whole point); keeping the wizard's standalone checklist step (the UAT confusion source); keeping create/send pairs whole under Overview (rejected on UX preference for the People grouping, once point 5 removed the correctness cost); a distinct state/flag to mark user-opt-out separately from system stage-retirement (unnecessary once the stage filter disambiguates).

**Consequences:** a `concern` column lands on `BookingChecklistItem` and the template item shape; the checklist evaluator's blocking test changes (with a regression test for the skip-mid-chain case); the create/seed path gains an on-demand single-item seed; the Builder, new-booking form, and Settings all grow per-concern "Remind me about" controls. **Deferred:** wizard ↔ Builder convergence (dissolving the standalone wizard step into per-concern controls) is its own slice; surfacing reminder config on the detail-page record cards (Contract, Invoice, Communications) is a future extension; the user-facing "Smart Reminder" name is parked. **For the PRD/impl:** the "on/off" control must define how it renders an item already in a COMPLETE / BLOCKED / FAILED lifecycle state (cleanest: the toggle is tracked-vs-skipped, and lifecycle state shows *within* "on"); and on-demand-seeded items need a sensible `order` derived from template position, not appended, or the checklist loses its workflow narrative.

---

**Amendment (#556 — control build, 2026-06-23):** the design loop that built the reusable
"Remind me about" control (variant chosen via throwaway prototype) settled four points that
refine the "For the PRD/impl" note above:

- **The control does not render lifecycle state.** It overturns the parenthetical above
  ("lifecycle state shows within 'on'"): COMPLETE / BLOCKED / FAILED are **not** shown in the
  control — that is the **checklist's** job. The control is purely tracked-vs-skipped (on/off).
  A completed-but-tracked reminder simply reads as "on". This keeps the control a discovery +
  opt-out surface, not a status display.
- **Unified off-state.** A user-skipped reminder and a never-seeded (discoverable) one render
  **identically** — "Could remind you when the booking is X" / "Remind me". The seed-vs-un-skip
  distinction is the container's concern (different API calls: `POST …/reminders/:key/enable`
  vs `PATCH …/:itemId {SKIPPED|PENDING}`), never surfaced to the user.
- **Status coaching = the preceding stage.** Each reminder names the booking status the work is
  done *during* — i.e. the stage **before** its `requiredForStatus` (a prerequisite *for* the
  next stage), bold and in that status's colour. ENQUIRY appears as a display value though it is
  not a valid `requiredForStatus`.
- **Dependency chain deferred.** The "…, after you <prerequisite>" clause (the `dependsOn` chain,
  shown only when the dependency is a live gate — pending, tracked, not globally disabled,
  mirroring the point-5 blocking semantics) is **deferred to #557/#558**: the #555 selector DTO
  carries no dependency field, and the Venue tracer's only reminder (`add_venue`) has none. The
  presentational atom exposes an optional `after` slot ready for it.

---

**Amendment (#560 — create-surface resolution, 2026-06-23):** a design pass settled how the
"Remind me about" control reaches the New Booking form, and refined the dependency clause and the
custom-item shape. Supersedes the original "deferred: dissolving the standalone wizard step" note
for the create surface.

- **Dependency clause shipped (no longer deferred).** The "…, after you <prerequisite>" clause is
  built (#557/#558): the selector computes `after` from each default's `dependsOn`, reusing the
  evaluator's `isDepSatisfied` so it mirrors the point-5 blocking semantics exactly (COMPLETE /
  SKIPPED / absent never gate). Phrases are curated per prerequisite key; the auto-complete *hint*
  (a separate "✓ when …" tail for the client-committed milestones `contract_signed` /
  `song_requests`) also ships (#567). Both render on the shared atom.
- **The create form keeps its step-2 checklist configurator — re-skinned, not dissolved.** Rather
  than scatter per-concern controls into the step-1 section atoms (which would leave *two*
  configurators of the same seed array) or dissolve the step (blocked on a pre-creation home for
  concern-less customs), step 2 is **rebuilt as concern-grouped `RemindMeAbout` controls** (the
  five concerns, matching the Builder) plus a general "Other items" catch-all for concern-less
  customs. One configurator, the shared control, the richer coaching — satisfying Story 20 while
  honouring "don't remove the step". This supersedes the considered-and-rejected "single
  post-creation config screen": the screen stays, but becomes the in-context control.
- **Pre-creation = selection-as-state.** There is no booking (creation is atomic, ADR-0047), so
  the live-mutation container is *not* reused; only the presentational atom is, backed by local
  state that feeds the existing `checklistItems[]` create payload. Every *offered* reminder
  (applicable concern, current/future stage, not globally disabled) defaults **on** = "will be
  seeded"; the user toggles **off** to exclude. The rows + coaching come from a **preview
  endpoint** that runs the same selector over the user's template defaults at the chosen starting
  status (no selector/maps duplicated on the frontend). The **"after you …" clause is recomputed
  on the frontend from the live selection**, using backend-authored phrases the preview returns
  per row (`{prereqKey, phrase}`): a dependent shows the clause only while its prerequisite is
  itself selected — i.e. the same live-gate rule, with "selected" standing in for "will be
  PENDING". This makes the clause a *justification* for the more-dependent options (why keep both
  "create contract" and "send contract") exactly when the user is choosing what to seed.
- **Custom items carry a stage.** Every custom reminder — concern-tagged (added from a concern
  control) or concern-less (the "Other items" catch-all) — carries a `requiredForStatus` so it
  participates in the stage filter like a system reminder. (Refines #559, whose first cut made the
  per-concern add label-only; a follow-up adds the stage picker to that path.) A **per-booking**
  custom may be concern-less; a **global** template custom (#561) should carry **both** a stage
  **and** a concern — the concern is useful flagging for a reminder the musician knows they want
  on every booking.
