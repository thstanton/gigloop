/**
 * One-time, re-runnable data migration (#653): back-fill the stored `autoCompleteRule` on every
 * existing `balance_received` step row with the new `invoicePaid` rule.
 *
 * Run: bun run migrate:balance-received-rule
 *
 * Why it is needed: evaluation is catalogue-driven (STEP_PREDICATES is built from CHECKLIST_DEFAULTS
 * by step key), so existing bookings already auto-complete `balance_received` on a PAID balance
 * invoice with no data change. But the frontend "Mark as paid" CTA is derived from the *stored*
 * step.autoCompleteRule (getChecklist → deriveShortcut), which stays `null` on rows seeded before
 * #653. This back-fills those rows so the CTA shows on existing bookings, and settles any
 * already-paid balance with an evaluate() sweep.
 *
 * The saved-template half was retired by ADR-0060 — checklist defaults are now stored as sparse
 * overrides and read-merged against the current catalogue, so the balance_received rule is always
 * taken fresh from the catalogue and never needs a template rewrite. This script reshapes rows only.
 *
 * Idempotent — a row already carrying the invoicePaid rule is skipped.
 */
import { PrismaClient } from '@prisma/client';
import {
  BALANCE_STEP_KEY,
  canonicalBalanceRule,
  isBalanceRuleCurrent,
} from '../checklist/checklist-balance-rule-migration';
import { ChecklistEvaluatorService } from '../checklist/checklist-evaluator.service';
import { ChecklistRepository } from '../checklist/checklist.repository';

async function main() {
  const prisma = new PrismaClient();
  const checklistRepo = new ChecklistRepository(prisma as never);
  const evaluator = new ChecklistEvaluatorService(checklistRepo);
  const rule = canonicalBalanceRule();

  try {
    const steps = await prisma.bookingChecklistStep.findMany({
      where: { key: BALANCE_STEP_KEY },
      select: { id: true, bookingId: true, autoCompleteRule: true },
    });
    console.log(`Found ${steps.length} balance_received steps to inspect`);

    let migrated = 0;
    let unchanged = 0;
    let failed = 0;
    const touchedBookings = new Set<string>();

    for (const step of steps) {
      if (isBalanceRuleCurrent(step.autoCompleteRule)) {
        unchanged++;
        continue;
      }
      try {
        await prisma.bookingChecklistStep.update({
          where: { id: step.id },
          data: { autoCompleteRule: rule as object },
        });
        touchedBookings.add(step.bookingId);
        migrated++;
        if (migrated % 10 === 0) console.log(`  Migrated ${migrated}...`);
      } catch (err) {
        console.error(`  Failed step ${step.id} (booking ${step.bookingId}):`, err);
        failed++;
      }
    }

    // Settle already-paid balances: evaluate() flips a non-terminal balance_received to COMPLETE
    // when its balance invoice is already PAID. COMPLETE steps/goals are sticky, so settled balances
    // are never re-opened.
    for (const bookingId of touchedBookings) {
      try {
        await evaluator.evaluate(bookingId);
      } catch (err) {
        console.error(`  Evaluate failed for booking ${bookingId}:`, err);
        failed++;
      }
    }

    console.log(`\nSteps migrated: ${migrated}, Unchanged (already current): ${unchanged}, Failed: ${failed}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
