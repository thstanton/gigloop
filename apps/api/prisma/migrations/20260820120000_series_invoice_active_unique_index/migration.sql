-- #852: back the "at most one non-VOID invoice per series" invariant with a real constraint.
-- SeriesService.createInvoice enforced this with a read-then-write guard and no constraint
-- behind it, so two concurrent create requests could both pass the guard and both create an
-- invoice. This is additive (a new index, nothing dropped or narrowed) so it ships in one step.
--
-- Hand-authored rather than `prisma migrate dev`-generated: Prisma's schema DSL cannot express a
-- filtered/partial unique index, so there is no corresponding `@@unique` in schema.prisma for the
-- migration engine to diff against. See the comment on `model Invoice` in schema.prisma.
--
-- VOID rows are deliberately excluded from the constraint: CONTEXT allows creating a fresh
-- invoice on a series after voiding the previous one, and ADR-0028's invoice-number reuse depends
-- on prior VOID rows persisting untouched.
CREATE UNIQUE INDEX "Invoice_seriesId_active_key"
  ON "Invoice" ("seriesId")
  WHERE "seriesId" IS NOT NULL AND "status" <> 'VOID';
