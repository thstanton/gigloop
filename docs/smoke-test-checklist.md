# Smoke-test critical-path checklist

Run this manually against the smoke-test environment before pushing a `v*` release tag (ADR-0044 §4/§7). It exercises the risky paths — money, PDFs, email delivery, multi-tenancy, and the client portal — on a prod-shaped stack with synthetic data, so a release candidate is never tagged untested.

Automate with Playwright once these flows stabilise (auth session pattern already saved from #360).

## Environment

- **Web:** https://preprod.gigloop.co.uk
- **API:** https://valiant-respect-staging.up.railway.app/api (Railway `staging` environment, project `gigman-be`)
- **DB:** Neon project `autumn-hill-65970446` (eu-west-2), seeded via `bun run seed` against `SEED_USER_ID`
- **Sign-in:** Clerk **development** instance. Test user `user_3G0hAnuoLfBCZbIqniyXmNHAEdZ` — sign in with its email using the Clerk dev-mode OTP `424242` (no real email is sent; any `+clerk_test@` address auto-verifies this way)
- **Email:** Resend, `RESEND_FROM=onboarding@resend.dev` — sandbox sender, only ever delivers to the Resend account's own inbox. A smoke-test send can never reach a real client by construction.
- **Storage:** R2 bucket `gigloop-preprod`

## Checklist

- [ ] **Sign in** at https://preprod.gigloop.co.uk with the dev-instance test user and confirm the seeded data is visible (10 contacts, 6 bookings, the Meridian `BookingSeries`, etc.) — this confirms `SEED_USER_ID` actually matches the signed-in Clerk user id.
- [ ] **Create a Booking** (any contact, any date) and confirm it appears in the bookings list.
- [ ] **Issue an Invoice** on a booking — confirm an invoice number is assigned and a PDF is stored (downloadable from the booking's documents).
- [ ] **Send the Invoice** — open the send composer, confirm the PDF attachment is present, send it, and confirm the send lands in the Resend sandbox (not a real inbox) and the invoice's status updates to SENT.
- [ ] **Mark the Invoice paid** and confirm the booking/checklist reflects it.
- [ ] **Contact — create.** Create a new contact and confirm it appears in the contacts list.
- [ ] **Contact — delete-block (409).** Attempt to delete a contact that has an associated booking (e.g. any seeded customer contact — Emma & James Whitfield, Sophie & Daniel Okafor, etc.) and confirm the API returns 409 with a clear error rather than deleting it. Then confirm the seeded deletable contact (**Kensington Roof Gardens** — zero booking references) *can* be deleted.
- [ ] **Portal walkthrough** at `/booking/:token` — use the seeded portal-walkthrough booking (Emma & James Whitfield, fee £2,200 at Barnsley House Hotel). Confirm:
  - The unsigned **Contract** is visible and can be signed through the portal.
  - The **published Music Form** is visible and can be filled in.
  - The page renders without requiring Clerk sign-in (portal routes bypass Clerk auth entirely, per the token).

## After running

- All boxes checked green → tagging a release is safe to proceed.
- Anything fails → do not tag. File/triage the failure before releasing.
