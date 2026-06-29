# ADR-0057 — The checklist is Goals composed of Steps (goal ⊃ step model)

**Status:** accepted — supersedes parts of ADR-0052 (per-concern reminders); amends ADR-0016 (stored checklist model). Grilled from the decision record in `docs/597-checklist-questlines-grill.md` (#597).

## Context

The flat [[BookingChecklistItem]] model forces a bad trade whenever a task is really a *multi-step deliverable*. The canonical case is an invoice, which is **create → issue → send** — three distinct system events (ADR-0042) — yet the checklist can only model it two ways, both wrong:

- **Under-model** → one coarse item ("Deposit invoice") that cannot coach the gap between steps. This is the #585 bug: the create action leaves a silent DRAFT with no signal it still needs issuing.
- **Over-model** → three independently-toggleable items, each a row in the per-concern "Remind me about" control (ADR-0052). Overwhelms the user, *and* creates the broken-chain problem (deselect "create" → "issue"/"send" dangle).

A flat list cannot express *"these are sub-steps of one thing."* Resolving that re-opens several checklist decisions that existed only to cope with the flat model — notably ADR-0052's `dependsOn` blocking-semantics and its routing of *sends* to the People concern.

## Decision

The checklist is modelled as **Goals composed of Steps**.

### Goal — the user-facing unit

A **Goal** is one outcome the musician wants reached (*get the contract signed*, *send the invoice to the client*). Goals are what the musician chooses, toggles and sees.

- The per-concern "Remind me about" control lists **Goals, never their Steps.** Steps are never individually user-toggleable.
- A goal is **owned by the musician**, lives in exactly **one lifecycle status** (`requiredForStatus`), and carries exactly **one `concern`** (where it is toggled).
- **System goal** (`key` present) may own multiple Steps that GigLoop sequences and auto-completes. **Custom goal** (`key` null, musician-authored) is **stepless and inert**. The system/custom discriminator is **`key`-presence and nothing else** — no new `kind`/`type` flag on the goal.
- A goal is **atomic** (zero steps; every custom goal and simple system goals like `add_venue`; carries its own auto-complete rule; renders as a plain checkbox) or **multi-step** (system-only; `state` rolls up from its steps; own rule null).
- **Goal states:** `PENDING | COMPLETE | FAILED | SKIPPED`. `SKIPPED` is the one state the musician sets directly — it is the opt-out (toggling the goal off, reversible).

### Step — the system-sequenced child of a multi-step goal

The fine granularity exists for the dependency chain *the system* tracks, **not** for the musician to "see where they're at." Steps are never user-toggled, completed steps fold away, and they are progressively disclosed (expand under the goal on demand) — never shown as locked rows.

Two orthogonal classifying fields:

- **`kind: MILESTONE | PRECONDITION | FOLLOWUP`** — what the step *is*. A **milestone** advances the deliverable (create → issue → send) and is the spine the progress measure counts; a **precondition** is an enabling prerequisite ("add the customer's email") that auto-resolves when its predicate is true; a **follow-up** is a time-based nudge ("chase the client"), event-anchored, non-blocking, auto-resolving when moot.
- **`completeMode: ACTION | AWAITED`** — *how* the step reaches COMPLETE: by the musician acting now (`ACTION`), or by awaiting an external event (`AWAITED`). **Orthogonal to `completedBy`** — `deposit_received` is `completedBy: USER` yet `completeMode: AWAITED`. `ACTION` steps drive continuation (the next step can fire immediately) and are the only steps that count toward the progress measure; `AWAITED` steps are the boundary where a follow-up belongs and never block.

A step also carries `completedBy: USER | CUSTOMER | BAND_MEMBER` (routes who acts). **Step states:** `PENDING | COMPLETE | FAILED` — never `SKIPPED`, never `BLOCKED`.

### What retires

- **`BLOCKED` retires.** Intra-goal sequencing is intrinsic `step.order` (the active step is *derived* — the first non-terminal step — never stored); inter-goal ordering is *soft* status order, never a hard lock. ADR-0052 point 5's blocking-semantics gymnastics retire with it.
- **`dependsOn` is dropped.** Intra-goal → `step.order`; inter-goal → status.
- **ADR-0052's "sends → People" concern fracture dissolves.** A *send* is inherently a cross-concern bridge — now a `send` step inside a goal, not a standalone item needing its own concern home. The goal carries the single concern.

### Surfacing

- **Single-booking checklist (detail page):** the aggressive hide + "Show all" is replaced by a **collapse/expand** view — a goal renders as one row showing its active step; completed steps and past-status groups collapse but remain expandable. "Where did my reminder go?" becomes a visible spatial fact (a left-behind goal sits in its collapsed past-status group).
- **Cross-booking surfaces (Dashboard Actions + DigestNotification):** the filter (stage gate + dated-within-window + undated-last-gate) carries over, re-expressed at goal granularity; the surfaced unit is a goal's active step. CUSTOMER-omission is **preserved** — passive CUSTOMER waits still never nag; the "assistant goes silent while waiting on the client" dead-spot is filled instead by an explicit **follow-up step** (a USER action). The unbuilt left-behind-task warning dialog (CONTEXT.md, [[Booking]] lifecycle) **retires** — the spatial checklist makes it redundant.

### Orchestration boundary

The checklist **orchestrates across concern seams; it never owns actions, and never mixes concerns.** Actions live in their domain surfaces (the Issue button belongs on the invoice sheet on its own merit — #585); the checklist *surfaces* "pending" and *routes* to the sheet that owns the action. Within-concern continuation (create → issue, both invoice) is driven by the **domain sheet** via canonical entity state; cross-concern continuation (issue invoice → send the email) is driven by the **goal** — the cross-concern through-line no single sheet can own. This amends the *contextual actions* principle (CONTEXT.md): domain sheets are **co-equal action surfaces**, not "not for primary workflow."

### Canonical vs shadow state

A milestone step is useful *shadow* state (reminders, "when did the user do X"); `Invoice.status` etc. is canonical. The two stay **decoupled** (the decoupling is why separate checklist state exists — derived state gave too little control when the user deviates), but a milestone naturally **shadows** the entity: auto-complete is *written* on the entity's business event. Precondition/follow-up steps are pure checklist state with no canonical source.

### Data model — two tables

Keep the existing `BookingChecklistItem` as the **Goal** (the user-facing row — minimal disruption to surfacing, the per-concern control, DTOs) and add a lean child table `BookingChecklistStep`. **Steps are persisted rows, not computed at read time** — same rationale ADR-0016 used to kill the original computed checklist, plus: follow-ups have no canonical source to derive from, and we need per-step state and "when did it happen" history. **Atomic goals are stepless** (today's flat items are already atomic goals → near-trivial migration); the evaluator branches `goal.steps.length ? rollUp(steps) : evaluate(goal.ownRule)`.

```
BookingChecklistItem   // = the GOAL (evolves the existing table)
  id, userId, bookingId, createdAt, updatedAt
  key                String?            // null = custom goal
  label              String
  concern            String?
  requiredForStatus  BookingStatus?     // the single status this goal serves
  order              Int
  state              ChecklistState     // roll-up of steps, OR own rule if atomic
  autoCompleteRule   Json?              // present ONLY for atomic goals; null once steps exist
  dueDate            DateTime?
  dueDateRule        Json?              // retained from the flat model — recomputes an atomic goal's dueDate on booking-date change (e.g. create_balance_invoice @ bookingDate−14)
  // dependsOn DROPPED; owner is always the musician (per-actor routing is on the step)

BookingChecklistStep   // NEW — children of a multi-step goal
  id, userId, bookingId, createdAt, updatedAt
  goalId             String             // FK → BookingChecklistItem.id
  key                String?            // 'issue', 'send', 'chase'
  label              String
  order              Int                // intrinsic sequence within the goal
  kind               MILESTONE | PRECONDITION | FOLLOWUP
  completeMode       ACTION | AWAITED
  state              ChecklistState
  completedBy        USER | CUSTOMER | BAND_MEMBER
  autoCompleteRule   Json?              // the predicate (registry-referenced)
  dueDateRule        Json?              // event-anchored (sibling completedAt + N) for follow-ups
```

## Considered options

- **Self-referential `BookingChecklistItem` + `parentId`** (one table). Rejected: a step has a genuinely different shape (`kind`/`completeMode`, no `concern`/`requiredForStatus`, never user-toggled, folds away) and lifecycle; `parentId` makes the row heavily polymorphic and muddies the existing item-as-user-facing-unit code. A lean child table keeps every column meaningful.
- **Every goal has ≥1 step** (pure-uniform). Rejected: a single eval path and stricter invariant, but it costs a redundant step row per atomic goal and a heavier migration for identical behaviour. Cheaper, lower-disruption atomic-goals-stepless wins.
- **Three independently-toggleable reminders per deliverable** (the flat-model status quo). Rejected: the over-model that overwhelms the user and dangles broken chains — the gap this ADR exists to close.
- **Computing steps at read time.** Rejected — see "steps are persisted" above.

## Consequences

- **Migration is bounded:** most existing items become atomic goals untouched; the invoice and contract item-clusters *collapse* into one goal + child steps (each old item's `autoCompleteRule` moves onto its step).
- **The evaluator gains the containment it lacked.** The flat model can't bound what an event affects (`dependsOn` is arbitrary keys), so `evaluate()` defensively recomputes everything in the request path — the parked **audit-H1** problem. The goal model bounds it: cascades are **goal-local**, goal state is a **roll-up** (materialised for cheap reads), predicates are per-step and declarative. A **predicate registry** (`stepKey → { predicate, inputs[], completeMode, … }`) with an **inverted index on `inputs`** turns a business event into an O(1) lookup of affected steps; the **same index serves the temporal path** (a follow-up cron tick is a targeted query). **H1 and this model are the same architecture from two ends — sequence the model first / fold them**, rather than hand-tuning a structure about to be replaced. New costs: bounded roll-up computation, materialised goal state (a pure function of its steps), and a scheduled eval path for follow-ups. The #584 quick-wins (#588–593) are orthogonal and stay valid; #587/#590's recomputed-return refines to "return/cache the affected *goal*."
- **Codifying auto-completion at the step level paves the way for user-authored multi-step goals** in a future wave — explicitly not designed now.

### v1 line

- **Core (earns the schema change):** the goal ⊃ step structure; the collapse/expand checklist redesign that retires `BLOCKED` + "Show all"; the `completeMode` mark; goals as the toggle unit in the per-concern control. v1 core ships **MILESTONE steps only** and stays purely event-driven (like today).
- **Increments on top:** precondition steps (share completeness predicates with the tips-widget / inline-hint system — don't fork the "is email set?" logic); time-based follow-up steps (need the scheduled cron + `completeMode`); the goal-level progress ring; a generic cross-concern continuation renderer.

## Supersedes / amends

- **ADR-0052** — the per-concern "Remind me about" control lists *Goals*, not items; point-5 blocking-semantics retire; the "sends under People" fracture is re-homed as cross-concern goal steps.
- **ADR-0016** — `dependsOn` / `requiredForStatus` move to the goal; the step is a new child shape; per-item `BLOCKED` retires from the user-facing layer.
- **CONTEXT.md** principles — *booking as epic* (subtasks-within-phase → goals⊃steps-within-phase), *contextual actions* (domain sheets are co-equal action surfaces), *reminders per concern* (lists Goals), and *discoverability* (preconditions reuse completeness predicates) are updated. "Smart Reminder" is demoted to a parked marketing concept, kept out of the code.

## Open (for the implementation prototype — deliberately not closed here)

- **Status-group explicitness** (the one genuinely-open UX question): how prominent the status-arc structure should be in the checklist view. Honest counter-precedent: the "Performance" umbrella was removed for being unperceived (CONTEXT.md) — explicit status grouping survives that test only if the *lived* lifecycle lands where an invented grouping didn't. Prototype when back online.
- **Goal-boundary cases** (where one goal ends and the next begins).
- **Follow-up: one-shot-via-reseeding vs a true re-arming type.**
- **Progress ring visual spec** (colour token, behaviour on FAILED/overdue).
- **Generic cross-concern continuation routing** — #585 wires the invoice → compose hand-off by hand; whether to make the cross-concern hop a general model-described behaviour is a deferred increment. #585's within-concern Issue button is permanent correct sheet design, not a stopgap.
