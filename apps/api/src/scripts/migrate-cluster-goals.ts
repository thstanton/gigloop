/**
 * One-time, re-runnable data migration (ADR-0057 / #608): collapse each existing booking's flat
 * item-clusters for the deposit, balance and song-request deliverables into their multi-step
 * goals (`get_deposit_paid`, `invoice_the_balance`, `gather_song_requests`).
 *
 * Run: bun run migrate:cluster-goals
 *
 * Idempotent — a booking that already has a given goal is skipped for that goal (the pure
 * planner returns null). After collapsing, a full-sweep evaluate() re-applies goal-level skips
 * and any auto-complete (e.g. a `send_deposit_invoice` step that had no flat predecessor is
 * completed if the deposit email was already sent), so each migrated goal lands in exactly the
 * state the live evaluator would compute. The contract goal is migrated by the separate
 * migrate:contract-goals script (already run on prod).
 */
import { PrismaClient } from '@prisma/client';
import { CHECKLIST_DEFAULTS, ChecklistDefaultItem } from '../bookings/checklist-defaults';
import {
  FlatChecklistItem,
  planGoalMigration,
  planTemplateMigration,
} from '../checklist/checklist-goal-migration';
import { ChecklistEvaluatorService } from '../checklist/checklist-evaluator.service';
import { ChecklistRepository } from '../checklist/checklist.repository';

const GOAL_KEYS = ['get_deposit_paid', 'invoice_the_balance', 'gather_song_requests'];

// Every flat step key across the three goals (used to find candidate bookings). Derived from
// the single source of truth so it can never drift from the goals' canonical step spines.
const ALL_STEP_KEYS = GOAL_KEYS.flatMap(
  (k) => CHECKLIST_DEFAULTS.find((d) => d.key === k)?.steps?.map((s) => s.key) ?? [],
);

// Collapse the old flat cluster entries in each user's SAVED checklist template
// (preferences.checklistDefaults) into the canonical goal entries, so new bookings seeded from
// that template carry the multi-step goals (AC1).
async function migrateTemplates(prisma: PrismaClient): Promise<void> {
  const profiles = await prisma.userProfile.findMany({ select: { userId: true, preferences: true } });
  let migrated = 0;
  for (const profile of profiles) {
    const prefs = (profile.preferences ?? {}) as Record<string, unknown>;
    const stored = prefs.checklistDefaults;
    if (!Array.isArray(stored)) continue; // empty → falls back to current CHECKLIST_DEFAULTS
    const next = planTemplateMigration(stored as ChecklistDefaultItem[], GOAL_KEYS);
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
    // Bookings that still hold any flat cluster item (and so may need collapsing). The planner
    // re-checks for an existing goal per goal key, so a partially-migrated booking is safe.
    const bookings = await prisma.booking.findMany({
      where: { checklistItems: { some: { key: { in: ALL_STEP_KEYS } } } },
      select: { id: true, userId: true },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`Found ${bookings.length} bookings with a flat deposit/balance/song cluster`);
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

        let collapsedAny = false;
        for (const goalKey of GOAL_KEYS) {
          const plan = planGoalMigration(items, goalKey);
          if (!plan) continue;
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
          collapsedAny = true;
        }

        if (!collapsedAny) {
          unchanged++;
          continue;
        }

        // Settle goal-level skips + auto-complete (e.g. a send step with no flat predecessor)
        // against the booking's live facts.
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

    // Saved checklist templates (so new bookings seed the goals).
    await migrateTemplates(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
