# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                            |
| -------------------------- | -------------------- | -------------------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue            |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information           |
| `ready-for-agent`          | `ready-for-agent`    | AFK — fully specified, ready for the loop          |
| `ready-for-human`          | `ready-for-human`    | HITL — requires human implementation or sign-off   |
| —                          | `ready-for-review`   | Loop finished the slice; awaiting human review     |
| —                          | `in-progress`        | Claimed by an active session (see `fleet.md`)      |
| `wontfix`                  | `wontfix`            | Will not be actioned                               |
| —                          | `escalate-to-grill`  | Triaged in depth; the design must be grilled first |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the right-hand column to match whatever vocabulary you actually use.

## `escalate-to-grill` — triaged, but the design isn't settled

Batch triage may return a verdict of **escalate** (see `fleet.md` → Batch triage, and the auto-escalation bright line in `issue-authoring.md`): the issue has been investigated properly, but it touches schema, a lifecycle/state machine, or cross-feature behaviour, so batch triage is not allowed to specify it. It needs a full `/grill-with-docs` before anyone can build it.

That verdict previously had no label, so such an issue stayed on `needs-triage` — indistinguishable from one nobody had looked at. The investigation was real work, and leaving it invisible invited a second session to redo it. `escalate-to-grill` is that missing state.

- **It replaces `needs-triage`.** A query for "what still needs a first look" must not return an issue that has already had a deep one.
- **The loop never selects it**, exactly as it never selects `ready-for-human`. It is not a work-ready state.
- **The next action is a grilling session, not implementation.** The grill's output is what moves the issue on — usually to `ready-for-agent`, sometimes to sibling issues, occasionally to `wontfix`.
- **The triage notes stay on the issue.** Escalating without recording what was established wastes the investigation; the grill should start from those notes, not re-derive them.

```
needs-triage ──batch triage investigates──▶ escalate-to-grill ──/grill-with-docs──▶ ready-for-agent
```

## AFK vs HITL (the loop boundary)

These two labels are the boundary the agent loop reads (ADR-0045). The distinction is about *what the work needs*, not how hard it is:

- **AFK (`ready-for-agent`)** — *all* acceptance criteria are machine-verifiable **and** the work carries no action a human must authorise. The loop can take it end to end.
- **HITL (`ready-for-human`)** — completing it *in full* needs human sign-off: **either** a criterion no automated check can express, **or** an irreversible/risky action (a DB migration, a destructive change) a human must authorise — *even when that action is itself testable*. The loop sees HITL issues (for dependency context) but never works them.

> This corrects the older "testability is the AFK/HITL boundary" (ADR-0040 §5), which was too narrow: a migration slice is testable yet still HITL.

## The loop's state machine (ADR-0045)

Labels — not commit content — are how the loop tracks doneness:

```
ready-for-agent  ──loop completes slice──▶  ready-for-review  ──human merges PR──▶  (closed)
       ▲                                          │
       └──────────── human rejects ───────────────┘   (+ a `## Rework — why` note on the issue)
```

- The loop **selects** only `ready-for-agent`; it skips `ready-for-review`, `ready-for-human` and `escalate-to-grill`.
- A `## Blocked by` ref is **satisfied** when that issue is *closed* OR labelled `ready-for-review` — never "has a `Closes` commit" (a rejected slice's `Closes` commit persists and would lie).
- A human who finishes a **HITL** issue must **close it or label it `ready-for-review`**, or its dependants stay wrongly blocked.

## `in-progress` — the fleet's claim token (see `fleet.md`)

Used by concurrent **interactive** sessions, not the loop. A claim is: label `ready-for-agent` → `in-progress` **+** self-assign **+** a comment naming the branch and worktree. The label drops off when the PR merges and the issue closes (or when a human un-claims a stale one by reverting the label). The set of `in-progress` issues *is* the in-flight map — sessions read it to enforce surface-disjointness and the WIP cap before starting work.
