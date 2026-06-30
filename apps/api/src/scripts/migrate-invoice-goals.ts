/**
 * One-time, re-runnable data migration (ADR-0057 / #617): reshape every existing booking's deposit
 * and balance goals into the new 4-step spine (create → issue → send → received) and rename the
 * balance goal `invoice_the_balance` → `get_the_balance_paid`. Also renames the balance entry in
 * every user's saved checklist template.
 *
 * Run: bun run migrate:invoice-goals
 *
 * MUST be run on each environment immediately after the #617 deploy — until it runs, existing
 * bookings keep the old 3-step deposit / 2-step balance shapes, and a saved template still carries
 * the old `invoice_the_balance` key (so a Settings → Checklist save would 400 on the stale key).
 *
 * Idempotent — a goal already in canonical shape is skipped (the pure planner returns null). After
 * reshaping, a full-sweep evaluate() reconstructs every rule-backed step from live invoice/comms
 * facts, so each migrated goal lands exactly where the live evaluator would compute it.
 */
import { PrismaClient } from '@prisma/client';
import { ChecklistDefaultItem } from '../bookings/checklist-defaults';
import {
  ExistingStep,
  planInvoiceGoalMigration,
  planInvoiceTemplateMigration,
} from '../checklist/checklist-invoice-migration';
import { ChecklistEvaluatorService } from '../checklist/checklist-evaluator.service';
import { ChecklistRepository } from '../checklist/checklist.repository';

// old goal key → canonical (target) goal key.
const GOAL_KEYS: Record<string, string> = {
  get_deposit_paid: 'get_deposit_paid',
  invoice_the_balance: 'get_the_balance_paid',
};

async function migrateTemplates(prisma: PrismaClient): Promise<void> {
  const profiles = await prisma.userProfile.findMany({ select: { userId: true, preferences: true } });
  let migrated = 0;
  for (const profile of profiles) {
    const prefs = (profile.preferences ?? {}) as Record<string, unknown>;
    const stored = prefs.checklistDefaults;
    if (!Array.isArray(stored)) continue; // empty → falls back to current CHECKLIST_DEFAULTS
    const next = planInvoiceTemplateMigration(stored as ChecklistDefaultItem[]);
    if (!next) continue;
    await prisma.userProfile.update({
      where: { userId: profile.userId },
      data: { preferences: { ...prefs, checklistDefaults: next } as object },
    });
    migrated++;
  }
  console.log(`Templates migrated: ${migrated}`);
}

async function main() {
  const prisma = new PrismaClient();
  const checklistRepo = new ChecklistRepository(prisma as never);
  const evaluator = new ChecklistEvaluatorService(checklistRepo);

  try {
    const goals = await prisma.bookingChecklistItem.findMany({
      where: { key: { in: Object.keys(GOAL_KEYS) } },
      select: {
        id: true,
        key: true,
        state: true,
        userId: true,
        bookingId: true,
        steps: { select: { key: true, state: true, completedAt: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`Found ${goals.length} deposit/balance goals to inspect`);

    let migrated = 0;
    let unchanged = 0;
    let failed = 0;
    const touchedBookings = new Set<string>();

    for (const goal of goals) {
      try {
        const canonicalKey = GOAL_KEYS[goal.key as string];
        const plan = planInvoiceGoalMigration(canonicalKey, goal.state, goal.steps as ExistingStep[]);
        if (!plan) {
          unchanged++;
          continue;
        }

        await prisma.$transaction(async (tx) => {
          await tx.bookingChecklistStep.deleteMany({ where: { goalId: goal.id } });
          await tx.bookingChecklistItem.update({
            where: { id: goal.id },
            data: {
              key: plan.newGoalKey,
              label: plan.newGoalLabel,
              state: plan.goalState,
              completedAt: plan.goalCompletedAt,
              steps: {
                create: plan.steps.map((s) => ({
                  userId: goal.userId,
                  bookingId: goal.bookingId,
                  key: s.key,
                  label: s.label,
                  order: s.order,
                  kind: s.kind,
                  completeMode: s.completeMode,
                  completedBy: s.completedBy,
                  state: s.state,
                  completedAt: s.completedAt,
                  ...(s.autoCompleteRule ? { autoCompleteRule: s.autoCompleteRule as object } : {}),
                  ...(s.dueDateRule ? { dueDateRule: s.dueDateRule as object } : {}),
                })),
              },
            },
          });
        });

        touchedBookings.add(goal.bookingId);
        migrated++;
        if (migrated % 10 === 0) console.log(`  Migrated ${migrated}...`);
      } catch (err) {
        console.error(`  Failed goal ${goal.id} (booking ${goal.bookingId}):`, err);
        failed++;
      }
    }

    // Settle rule-backed steps + goal-level skips against each touched booking's live facts.
    for (const bookingId of touchedBookings) {
      try {
        await evaluator.evaluate(bookingId);
      } catch (err) {
        console.error(`  Evaluate failed for booking ${bookingId}:`, err);
        failed++;
      }
    }

    console.log(
      `\nGoals migrated: ${migrated}, Unchanged (already done): ${unchanged}, Failed: ${failed}`,
    );

    await migrateTemplates(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
