-- Replace six *ReminderDays columns with a single preferences JSON column.
-- Existing reminder values are discarded; defaults apply from application logic.
ALTER TABLE "UserProfile"
  DROP COLUMN IF EXISTS "quoteReminderDays",
  DROP COLUMN IF EXISTS "contractReminderDays",
  DROP COLUMN IF EXISTS "depositInvoiceReminderDays",
  DROP COLUMN IF EXISTS "balanceInvoiceReminderDays",
  DROP COLUMN IF EXISTS "musicFormReminderDays",
  DROP COLUMN IF EXISTS "thankYouReminderDays",
  ADD COLUMN "preferences" JSONB NOT NULL DEFAULT '{}';
