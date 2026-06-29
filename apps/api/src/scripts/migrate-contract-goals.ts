/**
 * One-time, re-runnable data migration (ADR-0057 / #607): collapse each existing
 * booking's flat contract item-cluster (`create_contract`, `send_contract`,
 * `contract_signed`) into one `get_contract_signed` GOAL with its canonical child steps.
 *
 * Run: bun run migrate:contract-goals
 *
 * Idempotent — a booking that already has a `get_contract_signed` goal is skipped (the
 * pure planner returns null). After collapsing, a full-sweep evaluate() re-applies the
 * goal-level skip (READY makes signing moot) and any auto-complete, so the migrated goal
 * lands in exactly the state the live evaluator would compute.
 */
import { PrismaClient } from '@prisma/client';
import { ChecklistDefaultItem } from '../bookings/checklist-defaults';
import {
  FlatChecklistItem,
  planContractMigration,
  planTemplateMigration,
} from '../checklist/checklist-contract-migration';
import { ChecklistEvaluatorService } from '../checklist/checklist-evaluator.service';
import { ChecklistRepository } from '../checklist/checklist.repository';

const CONTRACT_STEP_KEYS = ['create_contract', 'send_contract', 'contract_signed'];

// Collapse the old flat contract entries in each user's SAVED checklist template
// (preferences.checklistDefaults) into the canonical get_contract_signed goal, so new
// bookings seeded from that template carry the multi-step contract goal (AC1).
async function migrateTemplates(prisma: PrismaClient): Promise<void> {
  const profiles = await prisma.userProfile.findMany({ select: { userId: true, preferences: true } });
  let migrated = 0;
  for (const profile of profiles) {
    const prefs = (profile.preferences ?? {}) as Record<string, unknown>;
    const stored = prefs.checklistDefaults;
    if (!Array.isArray(stored)) continue; // empty → falls back to current CHECKLIST_DEFAULTS
    const next = planTemplateMigration(stored as ChecklistDefaultItem[]);
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
    // Bookings that still hold a flat contract item (and so may need collapsing). The
    // planner re-checks for an existing goal, so a partially-migrated booking is safe.
    const bookings = await prisma.booking.findMany({
      where: { checklistItems: { some: { key: { in: CONTRACT_STEP_KEYS } } } },
      select: { id: true, userId: true },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`Found ${bookings.length} bookings with a flat contract cluster`);
    if (!bookings.length) {
      console.log('Nothing to do');
      return;
    }

    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    for (const booking of bookings) {
      try {
        const items = (await prisma.bookingChecklistItem.findMany({
          where: { bookingId: booking.id },
          select: { id: true, key: true, state: true, completedAt: true, dueDate: true, order: true },
        })) as FlatChecklistItem[];

        const plan = planContractMigration(items);
        if (!plan) {
          skipped++;
          continue;
        }
        const { goal, steps, deleteIds } = plan;

        await prisma.$transaction(async (tx) => {
          await tx.bookingChecklistItem.create({
            data: {
              userId: booking.userId,
              bookingId: booking.id,
              key: goal.key,
              label: goal.label,
              completedBy: goal.completedBy,
              state: goal.state,
              completedAt: goal.completedAt,
              order: goal.order,
              dependsOn: [],
              requiredForStatus: goal.requiredForStatus,
              dueDate: goal.dueDate,
              ...(goal.dueDateRule ? { dueDateRule: goal.dueDateRule as object } : {}),
              steps: {
                create: steps.map((s) => ({
                  userId: booking.userId,
                  bookingId: booking.id,
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
          await tx.bookingChecklistItem.deleteMany({ where: { id: { in: deleteIds } } });
        });

        // Settle goal-level skip + auto-complete against the booking's live facts.
        await evaluator.evaluate(booking.id);

        migrated++;
        if (migrated % 10 === 0) {
          console.log(`  Migrated ${migrated}...`);
        }
      } catch (err) {
        console.error(`  Failed booking ${booking.id}:`, err);
        failed++;
      }
    }

    console.log(`\nBookings migrated: ${migrated}, Skipped (already done): ${skipped}, Failed: ${failed}`);

    // Saved checklist templates (so new bookings seed the contract goal).
    await migrateTemplates(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
