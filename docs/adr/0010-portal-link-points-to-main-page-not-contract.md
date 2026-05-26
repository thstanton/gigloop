# ADR-0010: {{portalLink}} points to the main portal page, not the contract signing page

## Status
Accepted

## Context
The `contract_cover` and `contract_and_deposit_cover` email templates include a `{{portalLink}}` variable. The primary purpose of these emails is to send the client a link to sign the contract. A natural instinct would be to link directly to `/booking/:token/contract` so the client lands on the signing page immediately.

However, `{{portalLink}}` is a shared variable used across all template types — confirmation, quote, music form invite, and others. These non-contract templates use the link to direct the client to their booking summary, not to a signing page.

Separate variables were considered: `{{portalLink}}` for the main page and `{{contractLink}}` for the contract signing page. This would allow contract emails to link directly to the signing step.

## Decision
`{{portalLink}}` always resolves to `/booking/:token` (the main portal page). There is no `{{contractLink}}` variable. Contract email copy guides the client to sign from the main page, where a prominent "View & sign contract" button navigates to `/booking/:token/contract`.

## Consequences
- The client receiving a contract email must click twice to reach the signing UI (email link → main page → sign button).
- The first click orients the client to their full booking (date, venue, fee, greeting) before they sign — this is intentional. For many clients this is their first encounter with the portal.
- A single shared `{{portalLink}}` variable keeps the template variable set small and consistent.
- If a future use case demands a direct contract link (e.g. a reminder email after the client hasn't signed), a `{{contractLink}}` variable can be added then. The cost of adding it later is low; the cost of having two link variables confuse musicians in the template editor is ongoing.
