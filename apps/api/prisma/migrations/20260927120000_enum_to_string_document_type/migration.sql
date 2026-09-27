-- Migrate Document.type from DocumentType enum to TEXT (#893, ADR-0073 §4).
-- A document type list is open (CONTEXT.md's "enums for closed lifecycles only" rule), and this
-- unblocks adding CALL_SHEET without another migration. Existing rows keep their values.
ALTER TABLE "Document" ALTER COLUMN "type" TYPE TEXT USING "type"::TEXT;

-- Drop the now-unused enum type
DROP TYPE IF EXISTS "DocumentType";
