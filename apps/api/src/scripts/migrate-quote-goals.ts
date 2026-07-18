/**
 * One-time, re-runnable data migration (ADR-0057 / #616): collapse each existing booking's two
 * flat quote items (`send_quote` + `confirm_quote`) into the multi-step goal
 * `get_the_quote_accepted` (send → accepted).
 *
 * Run: bun run migrate:quote-goals
 *
 * The saved-template half was retired by ADR-0060 — checklist defaults are now stored as sparse
 * overrides and read-merged against the current catalogue, so a retired key is dropped on read and
 * never needs a template rewrite. This script now reshapes existing booking rows only.
 *
 * Idempotent — a booking that already has the goal is skipped (the pure planner returns null).
 * After collapsing, a full-sweep evaluate() re-applies goal-level skips and any auto-complete, so
 * each migrated goal lands in exactly the state the live evaluator would compute.
 */
import { PrismaClient } from '@prisma/client';
import {
  FlatChecklistItem,
  planQuoteMigration,
} from '../checklist/checklist-quote-migration';
import { ChecklistEvaluatorService } from '../checklist/checklist-evaluator.service';
import { ChecklistRepository } from '../checklist/checklist.repository';

// The old flat quote keys — used to find candidate bookings.
const OLD_QUOTE_KEYS = ['send_quote', 'confirm_quote'];

async function main() {
  const prisma = new PrismaClient();
  const checklistRepo = new ChecklistRepository(prisma as never);
  const evaluator = new ChecklistEvaluatorService(checklistRepo);

  try {
    // Bookings that still hold a flat quote item (and so may need collapsing). The planner
    // re-checks for an existing goal, so a partially-migrated booking is safe.
    const bookings = await prisma.booking.findMany({
      where: { checklistItems: { some: { key: { in: OLD_QUOTE_KEYS } } } },
      select: { id: true, userId: true },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`Found ${bookings.length} bookings with a flat quote cluster`);
    if (!bookings.length) {
      console.log('Nothing to do (bookings)');
    }

    let migrated = 0;
    let unchanged = 0;
    let failed = 0;

    for (const booking of bookings) {
      try {
        const items = (await prisma.bookingChecklistItem.findMany({
          where: { bookingId: booking.id },
          select: { id: true, key: true, state: true, completedAt: true, dueDate: true, order: true },
        })) as FlatChecklistItem[];

        const plan = planQuoteMigration(items);
        if (!plan) {
          unchanged++;
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

        // Settle goal-level skips + auto-complete against the booking's live facts.
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

    console.log(
      `\nBookings migrated: ${migrated}, Unchanged (already done): ${unchanged}, Failed: ${failed}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
