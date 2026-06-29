# Grill decision record — Checklist as domain-specific micro-journeys (goals ⊃ steps)

> **Status:** Draft decision record from a grill session (2026-06-26), branch
> `claude/grill-with-docs-w1uyer`. Pre-ADR — captures decided points, open
> questions for prototyping, and the supersede list, so the session's reasoning
> survives the ephemeral environment and can become an ADR + update #597 when the
> author is back online.
>
> **Relates:** #597 (the grill issue — checklist sub-step/subtask model), #585/#587
> (invoice-UX grind that parked #597), ADR-0016 (stored checklist), ADR-0052
> (per-concern reminders), ADR-0042 (invoice ISSUED state), ADR-0056 (invoice
> create/issue UX — authored but unpushed at time of writing).
>
> **Not decided:** the data-model fork (see §Unresolved). Everything below is the
> *conceptual* model the data model must serve.

---

## The gap (from #597)

The checklist forces a bad trade whenever a task is really a *multi-step deliverable*
(canonical case: an invoice is **create → issue → send**, three distinct system
events per ADR-0042):

- **Under-model** → one coarse item ("Deposit invoice") that cannot coach the gap.
  This is the #585 bug: the create action leaves a silent DRAFT with no signal it
  still needs issuing.
- **Over-model** → three independently-toggleable Smart Reminders, each a row in the
  per-concern "Remind me about" control (ADR-0052). Overwhelms the user, *and*
  creates the broken-chain problem (deselect "create" → "issue"/"send" dangle).

A flat list cannot express *"these are sub-steps of one thing."* This record resolves
that — and, in doing so, re-opens several checklist decisions that only existed to
cope with the flat model.

## The reframe: domain-specific micro-journeys (questlines)

Think of the checklist as **questlines**: the musician sets the goals, the system
manages the steps to get them there. Three levels, each with a home in the model:

| Tier | Questline term | What it is | Existing construct |
|---|---|---|---|
| 3 — "Get the gig confirmed" | chapter (a status arc) | a lifecycle stage; **musician-judged** | `requiredForStatus` |
| 2 — "Send the invoice to the client" | quest (the goal) | the user-facing unit — chosen, toggled, *seen* | **(new — the one gap)** |
| 1 — "Create the invoice" | objective (a step) | system-run; *directs* the next action, then folds away | `BookingChecklistItem` + ordering |

Who touches what: **the user chooses and sees goals; the system runs and surfaces
steps.** The fine granularity exists for the dependency chain *we* track, not for the
user's benefit of "seeing where they're at."

---

## Decided

1. **The Goal is the one new first-class object, and the user-facing selection unit.**
   The per-concern "Remind me about" control (ADR-0052) lists **goals, never their
   steps**. Steps are never individually user-toggleable — they're system-sequenced
   *inside* a goal. This dissolves #597's broken-chain problem by construction:
   within-goal steps are intrinsically ordered (no user-severable `dependsOn`), and
   goals are independent toggles.

2. **Uniform structure: a goal owns 1..N steps; everything is a goal.** Tiers 1 and 2
   are not disjoint classes — a single-action goal is just a one-step (leaf) quest.
   A custom todo ("bring spare strings") and an atomic Smart Reminder ("add the venue")
   are 1-step goals; the invoice is a 3-step goal. One uniform structure → the
   extensibility prize: a new multi-step workflow later is "author a goal with steps,"
   reusing all existing machinery.

3. **Tier-3 (status chapter) = a derived organising frame, NOT a first-class entity.**
   The reason is principled, not cost: `CONTEXT.md:46` makes booking status the
   musician's *manual judgement of readiness*, never a task tally ("No status
   transition is mechanically triggered by task completion"). Tiers 1–2 are
   system-observable facts that roll up cleanly; tier-3 is a judgement. A completable
   meta-goal would recreate exactly the auto-advance the lifecycle forbids — a category
   error. So `requiredForStatus` simply moves up to the *goal* level (steps don't each
   carry it — a simplification), and the chapter ("what's left to reach Confirmed") is a
   **derived view**, including any progress ring. The RPG metaphor bends here: finishing
   a chapter's goals *suggests* the transition ("you're ready to confirm"); the musician
   still makes the call (already ADR-0016 + the surfacing nudge `CONTEXT.md:368`).

4. **Invariant: a goal lives in exactly one stage.** A goal that appears to straddle
   two stages is the tell that it's actually two goals ("get paid" = deposit @ CONFIRMED
   + balance @ COMPLETE → two goals). Buys a perfectly nested tree (stage-gating drops a
   *whole* goal cleanly, never stranding half) and preserves "stage = completable unit."
   No counterexample found across contract / invoice / music-form / itinerary.

5. **Steps are progressively disclosed, not hidden.** "The user never sees the steps
   *unless they want to*." A goal renders as one row showing its current actionable step;
   completed steps fold away; steps **nest under the goal and expand on demand**. This
   *replaces* today's aggressive filtering + "Show all" with **collapse/expand** at two
   levels: expand a goal → its steps; collapse a completed chapter → past stages on
   demand. Fold ≠ delete (history stays expandable).

6. **`BLOCKED` retires from the user-facing layer.** The flat model locks items because
   it has no container; a real container removes the need. Within-goal sequencing →
   intrinsic step order (show the active step, never a locked row). Inter-goal ordering →
   soft stage order, *not* hard locks (`CONTEXT.md:46`: the lifecycle is never
   mechanically gated). `BLOCKED` may survive internally as "which step is active," but
   the user never sees a locked row again. ADR-0052's point-5 blocking-semantics
   gymnastics largely retire with it.

7. **The surfacing rule collapses to one sentence.** "The live work is the current
   chapter's open goals and their active steps; past chapters are done, future chapters
   are preview." This is also the fix for the *team's* own confusion between target
   status (`requiredForStatus`) and current status (`Booking.status`) — the three-part
   filter (`CONTEXT.md:364–368`) is too subtle. The quest log makes the rule a **visible
   spatial fact**: a skipped `deposit_received` sits visibly in the collapsed "To confirm"
   chapter you've moved past, so "why did my reminder vanish?" becomes "that's behind me."
   This **retires the unbuilt left-behind-task dialog warning** (`CONTEXT.md:366`) — the
   problem is solved structurally.

8. **Steps come in roles that are configurations of one mechanism**:
   `step = { surface-when, resolve-when, blocks? }`. The roles:
   - **Milestone** — advances the deliverable (create, issue, send). The *spine* the
     progress ring measures. Monotonic, ordered, auto-completes on a business event.
   - **Precondition** — an enabling prerequisite ("add the customer's email"). *Off-spine.*
     Auto-completes when its predicate is true (possibly instantly). **This is the prize:**
     a bare "remind me to add your email?" is absurd, but framed by a goal — "to send the
     invoice, add the customer's email" — it's legible. The goal model turns context-free
     completeness nags (today's Category-1 inline hints / tips widget, `CONTEXT.md:33,35`)
     into context-rich subtasks, unlocking guidance we currently *can't* offer. Share the
     *predicate* with the existing hint system; don't fork the "is email set?" logic.
   - **Follow-up** — a time-based nudge ("chase the client"). *Off-spine.* Event-anchored
     timing (5 days after the *send step* completed, not relative to the booking date);
     **non-blocking**; **auto-resolves when moot** (client signs before you chase). Fills a
     real dead-spot: today CUSTOMER passive-waits are omitted from Actions/Digest
     (`CONTEXT.md:364,462`), so the assistant goes *silent* right when a human assistant
     would say "chase them." Lean: **start one-shot; express "re-arm" as on-demand
     re-seeding** (ADR-0052 already allows post-creation seeding) rather than a new
     recurring type. Needs a *scheduled* re-evaluation (time, not events) — can ride the
     existing digest cron (`@nestjs/schedule`, `CONTEXT.md:375`).

9. **Two orthogonal axes classify every step→step edge** (the unifying result — #585's
   continuation and the follow-up are the same mechanism seen from two sides):
   - **`action` vs `awaited`** (can it be done now, or do we wait on an external event?).
     The one genuinely-useful thing to *mark* on a step — `completedBy` doesn't capture it
     (`deposit_received` is USER-marked but *awaits* payment). Powers: continuation (chain
     through `action` steps) ⊕ follow-up (nudge at the boundary into an `awaited` step) ⊕
     the progress denominator (only `action` milestones count, so on-demand `awaited`/helper
     steps never make the ring lurch backwards). Mark explicitly, derive by default.
   - **within- vs cross-concern** → *who drives the continuation* (see 11).

10. **Goal ownership vs step actor.** A goal is **owned by the musician** (it's their
    outcome); `completedBy` lives on the *steps* and routes who acts. This gives the
    current outliers a natural home: `deposit_received` and band-member confirmations stop
    being "weird things to remind someone about" and become *terminal steps of a goal the
    musician owns but doesn't personally execute*, with the follow-up as the mechanism that
    turns a stalled someone-else step back into a musician action. Especially clean for
    Wave 2 bands: "Get the band confirmed" is the leader's goal; the individual
    confirmations are `BAND_MEMBER` steps.

11. **The checklist orchestrates across concern seams; it never owns actions, and never
    mixes concerns.** Driven by the #585 defence — the Issue button belongs on the invoice
    sheet *on its own merit*, for the freewheeler as much as the checklist user. So:
    - Actions live in their **domain surfaces**; the checklist *surfaces* "pending" and
      *routes* to the surface that owns the action. (Amends `CONTEXT.md:11`: domain sheets
      are co-equal action surfaces, not "not for primary workflow.")
    - **Within-concern continuation** (`create → issue`, both invoice): the **domain sheet**
      drives it via canonical entity state. No checklist rendering; the "expensive generic
      in-flow renderer" I'd feared is unnecessary here.
    - **Cross-concern continuation** (`issue invoice → send the email`): the **checklist**
      is the right driver — forcing it inline would pollute a sheet with another concern
      (you'd never put "Send email" on a "Create invoice" sheet).
    - Therefore **a goal is the cross-concern through-line no single sheet can own.** "Get
      the deposit paid" threads invoice-create → invoice-issue → comms-send →
      payment-receipt — four steps, three concerns. Each within-concern hop stays sovereign
      to its sheet; the goal holds the cross-concern chain together. The checklist operates
      at the **seams between sheets, never inside them.** (This is also why ADR-0052's
      "sends grouped under People, fracturing three `dependsOn` chains" felt awkward — a
      *send* is inherently a cross-concern bridge, which is the goal-step's job.)

12. **The combined contract + deposit send** (the model's hardest case — came out
    *cleaner* than the status quo): **two goals** ("Get the contract signed", "Get the
    deposit paid"), each a clean tree owning **its own `send` step**. The combined email is
    **one `Communication` event that auto-completes the send step in both** (the
    `communicationSent` rule is already event→step, naturally one-event-satisfies-many).
    The UI **composes** a single "Send contract & deposit invoice" action when both goals'
    active steps coincide — *optional, presentational* polish ("co-satisfiable steps →
    composed action", a reusable pattern, e.g. contract + music-form invite). Structure
    stays two trees; nothing is shared but the *trigger*. The **no-deposit user falls out
    for free**: no deposit goal is seeded, so the action is simply "Send contract." Not a
    combo goal (merges two distinct deliverables, breaks the no-deposit case); not a
    two-parent subtask (turns the tree into a DAG).

13. **Progress measure: a goal-level ring, not the Builder rail.** Distinct from the
    Builder completeness rail (`CONTEXT.md:520`), which measures *information completeness
    by section*; the ring measures *workflow progress by goal* — they share only the
    predicate layer where a step is literally a completeness fact (don't compute "venue
    set?" twice). Only **multi-step** goals earn a ring (atomic = plain checkbox). The ring
    is the *aggregate* form of step-visibility — it's what *lets* the step list stay hidden,
    so it reinforces "steps fold away" rather than contradicting it. Only milestone steps
    count toward it (see 9). Visual: **gentle, motivating, within the existing palette — the
    usual green, not status-coded**, a thin arc round the checkbox; no second decorative
    accent competing with the date badge (`CONTEXT.md:9`), no XP/confetti.

14. **Canonical vs shadow state stay decoupled, but shadowing is natural.** The checklist
    step is useful *shadow* state (reminders, "when did the user do X"); `Invoice.status`
    etc. is canonical. They shouldn't be coupled, but one naturally shadows the other.
    Separate checklist items exist precisely because derived state gave too little control
    when the user didn't follow the laid-out path. The decoupling even hosts *new* useful
    reminders the entity has no reason to model (e.g. fee amended while a deposit draft is
    unissued → "update the deposit amount").

---

## Open — for the prototype / author's next online session

- **Chapter explicitness (the one genuinely unresolved UX question).** Author's instinct:
  lighter-touch. But 4 UAT sessions / 2 users show the lifecycle structure is *invisible*,
  and the team itself confuses target vs current status. Hypothesis to prototype: *an
  explicit-but-restrained chapter structure (current chapter open with its goals; past
  collapsed-but-present; future previewed) makes "what do I do next" and "why did that
  reminder stop" self-evident without feeling heavier than today's list.* Success
  criterion: a user can answer "what's left to get this gig confirmed?" and "where did the
  deposit reminder go?" unprompted. Honest counter-precedent: the "Performance" umbrella was
  *removed* for being unperceived (`CONTEXT.md:15`) — chapters survive that test only if the
  *lived* lifecycle lands where an invented grouping didn't. Empirical → prototype when back
  online.
- **Goal-boundary cases.** Where exactly one goal ends and the next begins (e.g. is the
  deposit "send the invoice" + "receive payment", or one goal?). Implementation detail; the
  model accommodates the tinkering the flat model couldn't.
- **Follow-up: confirm one-shot-via-reseeding** vs a true re-arming type.
- **Progress ring visual spec** (exact colour token, behaviour on FAILED/overdue).
- **Generic cross-concern continuation routing** — the checklist linking `issue → send`.
  #585 wires the invoice→compose hand-off by hand (`onAfterIssue`); whether/when to make the
  cross-concern hop a general model-described behaviour is a deferred increment. #585's
  within-concern Issue button is **permanent correct sheet design, not a stopgap.**

## Deferred (the v1 line)

- **Core (earns the schema change, one coherent unit):** the goal ⊃ step structure; the
  quest-log UI redesign that retires `BLOCKED` + "Show all"; the `action`/`awaited` mark;
  goals as the toggle unit in the per-concern control.
- **High-value increments on top:** precondition steps; time-based follow-ups (need the
  cron + `action`/`awaited`); the progress ring (cheap — its own derived surface); the
  generic cross-concern continuation renderer.

## Supersedes / amends (blast radius — to name honestly in the eventual ADR)

- **ADR-0052** — per-concern "Remind me about" lists *goals*, not items; point-5
  blocking-semantics largely retired; the "sends under People" fracture is re-homed as
  cross-concern goal steps.
- **ADR-0016** — `dependsOn` / `requiredForStatus` move to the goal; the step is a new
  child shape; per-item `BLOCKED` retires from the user-facing layer.
- **`CONTEXT.md:11`** — the checklist is the cross-concern *orchestrator*, not the sole
  "primary interface"; domain sheets are co-equal action surfaces.
- **`CONTEXT.md:364–368`** — the surfacing filter re-expressed at goal granularity and
  simplified; the unbuilt left-behind-task dialog (`:366`) retired (solved spatially).
- **Detail-page** aggressive hide + "Show all" → collapse/expand quest log.

## Evaluation architecture (added at grill close — implications for the parked H1 redesign)

The model has direct implications for evaluator efficiency, and reframes the parked
`evaluate()` redesign (audit **H1**, parked by #584 and #587 for "its own profiling →
grill → ADR").

- **The #584 quick-wins (#588–593) are orthogonal** — over-fetch / over-invalidation /
  the `enabled: isLoaded` gate; none touch checklist evaluation. Stay valid as-is. The
  one checklist-touching pattern (#587's recomputed-checklist return + #590's
  `setQueryData`) **refines** rather than conflicts: a toggle's blast radius is now **one
  goal**, so return/cache the affected *goal*, not the whole checklist (smaller payload,
  narrower invalidation).
- **The model supplies the containment H1 has been missing.** The flat model can't bound
  what an event affects (`dependsOn` is arbitrary keys), so `evaluate()` defensively
  recomputes everything synchronously in the request path — that *is* the H1 problem. The
  goal model bounds it: cascades are **goal-local** (intra-goal ordering; inter-goal is
  soft, no hard locks), goal state is a **roll-up** (materialisable for cheap reads), and
  predicates are already per-step and declarative. **So H1 and this grill are the same
  architecture from two ends — sequence the model first / fold them.** Running H1 on the
  flat model hand-tunes a structure about to be replaced, and its hardest sub-problem
  (bounding re-evaluation) is dissolved by the containment, not solved by profiling.
- **The registry the model produces:** a **predicate registry** (`stepKey → { predicate,
  inputs[], role: action|awaited, surfaceWhen, resolveWhen }`) — the reification of
  "step = config of one mechanism", cleanly splitting the *system predicate catalog*
  (static, shared) from *per-booking instances* (materialised state) and *per-user
  defaults* (selected goals). An **inverted index on `inputs`** turns a business event
  into an O(1) lookup of affected predicates → re-evaluate only those steps → roll up only
  their goals. The **same index serves the temporal path**: a follow-up cron tick is a
  targeted query ("`awaited` steps whose event-anchored due has elapsed"), not a full
  sweep (rides the existing digest cron).
- **Honest new costs:** roll-up computation (bounded); **materialised goal state** (the one
  new discipline — a pure function of its steps, recomputed on any step change, blast-radius
  one goal); a **scheduled eval path** for follow-ups (new surface area, but H1's async
  decoupling + the digest cron bring it anyway). Net: adds bounded write/scheduled cost,
  removes the dominant cost (full synchronous recompute per toggle that #587 fought).

## Proposed data-model resolution

**Steps are PERSISTED rows, not derived/computed (decided).** Same rationale ADR-0016 used
to kill the original computed checklist — derived state gave too little control when the user
deviates — plus two reasons specific to this model: (a) follow-ups have **no canonical source**
to derive from ("chase the client" is backed by no entity); (b) we need per-step override,
SKIP, and "when did it happen" history. The registry/inverted-index (eval section) is an
*indexing* optimisation over stored rows — it must **not** be misread as a licence to compute
steps at read time. Milestone steps *shadow* canonical entity state (auto-complete is *written*
on the entity event, e.g. `invoice.status → ISSUED`); precondition/follow-up steps are pure
checklist state. Authoritative + stored, never derived-on-read.

**Two tables (proposed).** Keep the existing `BookingChecklistItem` as the **goal** (the
user-facing row — minimal disruption to surfacing, the per-concern control, DTOs) and add a
lean child table for steps:

```
BookingChecklistItem   // = the GOAL (evolves the existing table)
  id, userId, bookingId, createdAt, updatedAt   // hard-rule fields, unchanged
  key                String?            // null = custom goal
  label              String
  concern            String?            // ADR-0052 section
  requiredForStatus  BookingStatus?     // single stage this goal serves (decision 4)
  order              Int
  state              ChecklistState     // materialised: roll-up of steps, OR own rule if atomic
  autoCompleteRule   Json?              // present ONLY for atomic goals; null once steps exist
  dueDate            DateTime?
  // dependsOn DROPPED — intra-goal ordering → step.order; inter-goal is soft/stage
  // owner is always the musician; per-actor routing lives on the step

BookingChecklistStep   // NEW — children of a multi-step goal
  id, userId, bookingId, createdAt, updatedAt
  goalId             String             // FK → BookingChecklistItem.id
  key                String?            // 'issue', 'send', 'chase'
  label              String
  order              Int                // intrinsic sequence within the goal
  role               ACTION | AWAITED   // decision 9 — continuation vs follow-up
  kind               MILESTONE | PRECONDITION | FOLLOWUP   // decision 8
  state              ChecklistState
  completedBy        USER | CUSTOMER | BAND_MEMBER         // routes the action
  autoCompleteRule   Json?              // the predicate (registry-referenced)
  dueDateRule        Json?              // event-anchored (sibling completedAt + N) for follow-ups
```

**Atomic goals are stepless** — they carry their own `autoCompleteRule` and no step rows, so
they are *unchanged from today* ("Add the venue" stays one row, no redundant duplicate step).
**Multi-step goals** have child steps and roll up (goal `autoCompleteRule` null). Evaluator
branches trivially: `goal.steps.length ? rollUp(steps) : evaluate(goal.ownRule)`. The goal row
holds the *materialised* roll-up + active-step pointer (cheap surfacing reads); step rows are
the predicate source the inverted input-index hits — goal = summary, steps = granular source.

**Why two tables over self-referential `BookingChecklistItem` + `parentId`:** steps have a
genuinely different shape (role/kind, no concern/`requiredForStatus`, never user-toggled, fold
away) and lifecycle; a `parentId` makes the item heavily polymorphic and muddies the existing
item-as-user-facing-unit code. A lean child table keeps every column meaningful.

**Migration (bounded):** most existing items become atomic goals untouched; the invoice and
contract item-clusters *collapse* into one goal + child steps (the `autoCompleteRule` from each
old item moves onto its step).

### Sub-choice — RATIFIED: atomic-goals-stepless (pragmatic)

An atomic goal carries its own `autoCompleteRule` and **no step rows** (so today's flat items
are already atomic goals — near-trivial migration, no redundant duplicate rows). A multi-step
goal has child steps and rolls up (own rule null). The evaluator branches:
`goal.steps.length ? rollUp(steps) : evaluate(goal.ownRule)`.

Rejected: every-goal-has-≥1-step (pure-uniform) — a single eval path and stricter invariant,
but it costs a redundant step row per atomic goal and a heavier migration for no behavioural
gain. The difference is purity vs migration cost; both produce identical behaviour, so the
cheaper, lower-disruption option wins.
