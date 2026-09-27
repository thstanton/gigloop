-- #1035: let a musician mark the Contact that "is them" — the account owner — so they can add
-- themselves to a band roster without hand-rolling CRM data entry (ADR-0083). Additive column
-- (no backfill needed), so it ships in one step.
ALTER TABLE "Contact" ADD COLUMN "isAccountOwner" BOOLEAN NOT NULL DEFAULT false;

-- Enforce "at most one account-owner Contact per tenant" as a real constraint rather than a
-- service-level read-then-write guard — that pattern already proved racy under concurrent writes
-- for Invoice's "at most one active invoice per series" invariant (#852). Hand-authored rather
-- than `prisma migrate dev`-generated: Prisma's schema DSL cannot express a filtered/partial
-- unique index, so there is no corresponding `@@unique` in schema.prisma for the migration engine
-- to diff against. See the comment on `model Contact` in schema.prisma.
CREATE UNIQUE INDEX "Contact_userId_accountOwner_key"
  ON "Contact" ("userId")
  WHERE "isAccountOwner" = true;
