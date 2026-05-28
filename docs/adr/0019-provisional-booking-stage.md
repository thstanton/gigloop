# Provisional booking stage added between Enquiry and Confirmed

User research revealed a missing lifecycle state. In practice, the moment a client verbally agrees to a quote is meaningfully distinct from both "initial interest" (Enquiry) and "contract signed + deposit received" (Confirmed). Without it, musicians were creating bookings directly as Confirmed — which is dishonest about the booking's actual state — or skipping Enquiry entirely because it felt wrong for a booking that was already agreed in principle.

The lifecycle is now `Enquiry → Provisional → Confirmed → Ready → Complete`. Provisional means: the client has said yes, formalities are outstanding. It is the standard creation entry point. The Enquiry stage retains value for P2 email ingestion (auto-created bookings from inbound emails). Enquiry bookings are excluded from the dashboard calendar and Upcoming Gigs widget; Provisional and above are included.

This drives two downstream decisions: `send_quote` and `confirm_quote` are `requiredForStatus: PROVISIONAL`; the checklist seeding rule skips items belonging to stages before the booking's creation status (so a booking created at Provisional never sees Enquiry-stage items, and a booking created at Confirmed skips Provisional items too).

## Considered options

- **Keep 4 stages, rename Enquiry to Provisional** — rejected; Enquiry has genuine P2 value for speculative bookings created by email ingestion before any quote is sent. The two states are semantically distinct.
- **Add a boolean `quoteAccepted` field instead** — rejected; a boolean doesn't integrate with the checklist seeding rule, the dashboard filter, or the status pill display. A proper status value carries all of those for free.
