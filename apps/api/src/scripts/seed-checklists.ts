/**
 * One-time migration: seed BookingChecklistItem records for existing bookings.
 *
 * Run: bun run seed:checklists
 *
 * Idempotent — skips bookings that already have checklist items.
 * After seeding, evaluates auto-complete rules so items start in the correct state.
 */
import { PrismaClient } from '@prisma/client';
import { CHECKLIST_DEFAULTS, computeDueDate, getChecklistDefaults } from '../checklist/checklist-defaults';
import { ChecklistEvaluatorService } from '../checklist/checklist-evaluator.service';
import { ChecklistRepository } from '../checklist/checklist.repository';

const STATUS_ORDER = ['ENQUIRY', 'CONFIRMED', 'READY', 'COMPLETE', 'CANCELLED'];

function statusGte(current: string, threshold: string): boolean {
  return STATUS_ORDER.indexOf(current) >= STATUS_ORDER.indexOf(threshold);
}

async function main() {
  const prisma = new PrismaClient();
  const checklistRepo = new ChecklistRepository(prisma as never);
  const evaluator = new ChecklistEvaluatorService(checklistRepo);

  try {
    // Find all non-CANCELLED bookings without any checklist items
    const bookings = await prisma.booking.findMany({
      where: {
        status: { not: 'CANCELLED' },
        checklistItems: { none: {} },
      },
      select: {
        id: true,
        userId: true,
        status: true,
        date: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`Found ${bookings.length} bookings to seed`);
    if (!bookings.length) {
      console.log('Nothing to do');
      return;
    }

    // Load all user profiles in one query
    const userIds = [...new Set(bookings.map((b) => b.userId))];
    const profiles = await prisma.userProfile.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, preferences: true },
    });
    const profileMap = new Map(profiles.map((p) => [p.userId, p]));

    let seeded = 0;
    let failed = 0;

    for (const booking of bookings) {
      try {
        const profile = profileMap.get(booking.userId);
        const defaults = getChecklistDefaults(profile?.preferences as Record<string, unknown> | null);

        const data = defaults.map((item, idx) => ({
          userId: booking.userId,
          bookingId: booking.id,
          key: item.key ?? null,
          label: item.label,
          completedBy: item.completedBy,
          state: 'PENDING',
          order: idx + 1,
          dependsOn: item.dependsOn,
          ...(item.autoCompleteRule !== null
            ? { autoCompleteRule: item.autoCompleteRule as object }
            : {}),
          requiredForStatus: item.requiredForStatus,
          dueDate: computeDueDate(item.dueDateRule, booking.date, booking.createdAt),
          ...(item.dueDateRule !== null
            ? { dueDateRule: item.dueDateRule as object }
            : {}),
        }));

        await prisma.bookingChecklistItem.createMany({ data });

        // Evaluate auto-complete rules against existing booking data
        await evaluator.evaluate(booking.id);

        seeded++;
        if (seeded % 10 === 0) {
          console.log(`  Seeded ${seeded}/${bookings.length}...`);
        }
      } catch (err) {
        console.error(`  Failed booking ${booking.id}:`, err);
        failed++;
      }
    }

    console.log(`\nDone. Seeded: ${seeded}, Failed: ${failed}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
