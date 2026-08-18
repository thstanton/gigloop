-- TIM-45 / ADR-0068: capture an optional payment reference alongside the received date.
-- Additive, nullable column — existing paid invoices are untouched and keep their (approximate)
-- dates and a null reference. One-step change (no expand/contract needed for a new nullable column).
-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "paymentReference" TEXT;
