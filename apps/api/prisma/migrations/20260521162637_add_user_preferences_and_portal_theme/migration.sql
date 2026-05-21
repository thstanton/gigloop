-- AlterTable
ALTER TABLE "PublicProfile" ALTER COLUMN "portalTheme" SET DEFAULT 'LIGHT_MODERN';

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "balanceInvoiceReminderDays" INTEGER,
ADD COLUMN     "contractReminderDays" INTEGER,
ADD COLUMN     "depositInvoiceReminderDays" INTEGER,
ADD COLUMN     "digestEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "musicFormReminderDays" INTEGER,
ADD COLUMN     "quoteReminderDays" INTEGER,
ADD COLUMN     "songRequestFormEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "thankYouReminderDays" INTEGER;
