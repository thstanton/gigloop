import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  BAND_CHECKLIST_GOAL_KEY,
  BAND_GOAL_KEYS,
  CHECKLIST_DEFAULTS,
  ChecklistDefaultStep,
  computeDueDate,
  computeReminderInsertOrder,
} from './checklist-defaults';
import { addDays, surfaceActionItems } from './checklist-surfacing';
import { activeStep, StepState } from './checklist-rollup';
import type {
  BandChecklistGoal,
  BandChecklistStepSyncData,
  BandGoalResetPlan,
  BandMemberStepSyncPlan,
} from './checklist-band-steps';
import { seedableChecklistSteps } from './checklist-band-steps';

export type ChecklistItemSeed = {
  key?: string | null;
  label: string;
  completedBy?: 'USER' | 'CUSTOMER' | 'BAND_MEMBER';
  dependsOn?: string[];
  autoCompleteRule?: Record<string, unknown> | null;
  requiredForStatus?: string | null;
  dueDateRule?: { basis: 'bookingDate' | 'bookingCreation'; offsetDays: number } | null;
  // A custom item seeded with its user-chosen concern (#560); null for system items and
  // concern-less customs.
  concern?: string | null;
};

type ActionChecklistItem = {
  id: string;
  key: string | null;
  label: string;
  state: string;
  dueDate: Date | null;
  requiredForStatus: string | null;
  order: number;
};

export interface BandSoloExitContext {
  // The solo-exit planner only needs identity and state. Checklist `key` is nullable for custom
  // rows, and the repository query's `key in` predicate does not narrow Prisma's generated type.
  goals: Array<{ id: string; state: string }>;
  preferences: Record<string, unknown>;
}

export interface BandSoloExitPlan {
  goalIdsToSkip: string[];
  preferences: Record<string, unknown>;
}

export type BandSoloExitPlanner = (context: BandSoloExitContext) => BandSoloExitPlan | null;

const BAND_CHECKLIST_GOAL_SELECT = {
  id: true,
  key: true,
  userId: true,
  state: true,
  steps: {
    select: { id: true, key: true, bandMemberId: true, label: true, order: true, state: true },
  },
} satisfies Prisma.BookingChecklistItemSelect;

@Injectable()
export class ChecklistRepository {
  constructor(private prisma: PrismaService) {}

  async findActionItems(userId: string, today: Date, reminderLeadDays: number) {
    const cutoff = addDays(today, reminderLeadDays);

    const bookings = await this.prisma.booking.findMany({
      where: {
        userId,
        date: { gte: today },
        status: { not: 'CANCELLED' },
      },
      orderBy: { date: 'asc' },
      select: {
        id: true,
        date: true,
        title: true,
        status: true,
        customer: { select: { name: true } },
        venue: { select: { name: true } },
        checklistItems: {
          where: {
            completedBy: 'USER',
            state: { in: ['PENDING', 'FAILED'] },
          },
          select: {
            id: true,
            key: true,
            label: true,
            state: true,
            dueDate: true,
            requiredForStatus: true,
            order: true,
            // A multi-step goal surfaces its *active* step (ADR-0057): the dashboard/digest
            // show the concrete next action, and the goal is omitted entirely while that
            // step awaits the client (CUSTOMER) — a passive wait never nags.
            steps: {
              select: { key: true, label: true, state: true, order: true, completedBy: true },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    return bookings
      .map(({ checklistItems, ...booking }) => {
        const surfaceable = checklistItems.flatMap((goal) => {
          const steps = goal.steps ?? [];
          if (steps.length === 0) return [goal as ActionChecklistItem];
          const active = activeStep(steps as Array<{ state: StepState; order: number }>);
          // No active step (goal rolled up) or the musician can't act yet (client's move) →
          // not a surfaceable action for the musician.
          if (!active) return [];
          const step = active as unknown as { key: string | null; label: string; completedBy: string };
          if (step.completedBy === 'CUSTOMER') return [];
          // Surface the goal's stage/due-date gate, but relabel to the active step's action.
          return [{ ...goal, label: step.label, key: step.key ?? goal.key } as ActionChecklistItem];
        });
        const surfaced = surfaceActionItems(surfaceable, booking.status, cutoff);
        return surfaced.length > 0 ? { booking, item: surfaced[0] } : null;
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);
  }

  async findItemsWithContext(bookingId: string) {
    const [items, raw] = await Promise.all([
      this.prisma.bookingChecklistItem.findMany({
        where: { bookingId },
        orderBy: { order: 'asc' },
        // Steps drive a multi-step goal's roll-up (ADR-0057) — the evaluator needs them
        // to recompute and persist step transitions alongside the goal.
        include: { steps: { orderBy: { order: 'asc' } } },
      }),
      this.prisma.booking.findUnique({
        where: { id: bookingId },
        select: {
          id: true,
          userId: true,
          status: true,
          venueId: true,
          customerId: true,
          // ADR-0078: series membership drives the SKIP of the deposit/balance goals.
          seriesId: true,
          // #618 precondition inputs: the booking's fee and its customer's email.
          fee: true,
          customer: { select: { email: true } },
          logistics: true,
          _count: { select: { sets: true } },
          communications: {
            select: {
              status: true,
              // #901: per-member comm predicates match on the recipient contact.
              contactId: true,
              template: { select: { builtInType: true } },
            },
            orderBy: { createdAt: 'asc' },
          },
          invoices: {
            // ADR-0057 / #617: DRAFT is now projected in (with its status) so the *create* step's
            // invoiceExists rule (includeDraft) can recognise a saved draft; the *issue* step's
            // rule still requires a non-DRAFT status (the #585 fix). VOID never counts as created.
            where: { status: { not: 'VOID' } },
            select: { isDeposit: true, status: true },
          },
          contracts: {
            where: { status: { not: 'VOID' } },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { status: true },
          },
          musicFormResponse: { select: { id: true } },
          // #533 / #630: publication drives the set_up_and_publish step's musicFormPublished rule.
          musicFormConfig: { select: { publishedAt: true } },
        },
      }),
    ]);
    const booking = raw
      ? {
          ...raw,
          setsCount: raw._count.sets,
          // Flatten to the BookingContext shape the rules read (#618).
          fee: raw.fee != null ? String(raw.fee) : null,
          customerEmail: raw.customer?.email ?? null,
          musicFormPublished: raw.musicFormConfig?.publishedAt != null,
        }
      : null;
    return { items, booking };
  }

  /** Read only the band goals + roster facts needed by the checklist service's sync plan. Any one
   * band goal is enough: a booking created at READY seeds the briefed goal without the confirmed one. */
  async findBandChecklistStepSyncData(
    userId: string,
    bookingId: string,
  ): Promise<BandChecklistStepSyncData | null> {
    const [goals, members, chairs] = await Promise.all([
      this.prisma.bookingChecklistItem.findMany({
        where: { bookingId, userId, key: { in: [...BAND_GOAL_KEYS] } },
        select: BAND_CHECKLIST_GOAL_SELECT,
      }),
      this.prisma.bookingBandMember.findMany({
        where: { bookingId, userId, removedAt: null },
        select: {
          id: true,
          status: true,
          isSelf: true,
          contactId: true,
          createdAt: true,
          contact: { select: { name: true } },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.bookingBandChair.findMany({
        where: { bookingId, userId },
        select: { memberId: true, member: { select: { status: true } } },
      }),
    ]);
    if (!goals.length) return null;
    return {
      goals,
      members,
      chairs: chairs.map((chair) => ({ memberId: chair.memberId, memberStatus: chair.member?.status ?? null })),
    };
  }

  /** Persist a service-computed roster-step plan; this method owns only Prisma writes. */
  async applyBandMemberStepSyncPlan(
    userId: string,
    bookingId: string,
    goalId: string,
    plan: BandMemberStepSyncPlan,
  ): Promise<void> {
    if (!plan.deleteStepIds.length && !plan.createSteps.length && !plan.updateSteps.length) return;
    const transaction: Prisma.PrismaPromise<unknown>[] = [];
    if (plan.reopenGoal) {
      transaction.push(
        this.prisma.bookingChecklistItem.updateMany({
          where: { id: goalId, bookingId, userId, state: 'COMPLETE' },
          data: { state: 'PENDING', completedAt: null },
        }),
      );
    }
    for (const id of plan.deleteStepIds) {
      transaction.push(
        this.prisma.bookingChecklistStep.deleteMany({ where: { id, goalId, bookingId, userId } }),
      );
    }
    for (const update of plan.updateSteps) {
      transaction.push(
        this.prisma.bookingChecklistStep.update({
          where: { id: update.id, bookingId, userId },
          data: { label: update.label, order: update.order },
        }),
      );
    }
    if (plan.createSteps.length) {
      transaction.push(
        this.prisma.bookingChecklistStep.createMany({
          data: plan.createSteps.map(({ template, label, order, memberId }) => ({
            ...this.buildStepData(template, order, userId, bookingId, memberId),
            goalId,
            label,
          })),
        }),
      );
    }
    // Step rows are part of the goal's version (ADR-0076); creation/removal must be
    // visible to clients even when the goal roll-up itself has not changed.
    transaction.push(
      this.prisma.bookingChecklistItem.updateMany({
        where: { id: goalId, bookingId, userId },
        data: { updatedAt: new Date() },
      }),
    );
    await this.prisma.$transaction(transaction);
  }

  /** Read the band goal state needed to compute roster-reset updates. */
  async findBandGoalResetData(userId: string, bookingId: string): Promise<BandChecklistGoal | null> {
    const goal = await this.prisma.bookingChecklistItem.findFirst({
      where: { bookingId, userId, key: BAND_CHECKLIST_GOAL_KEY },
      select: BAND_CHECKLIST_GOAL_SELECT,
    });
    return goal;
  }

  /** Persist a service-planned solo exit atomically with its inputs loaded inside this transaction. */
  async applyBandSoloExit(
    userId: string,
    bookingId: string,
    planSoloExit: BandSoloExitPlanner,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, userId },
        select: { id: true },
      });
      if (!booking) return false;

      const goals = await tx.bookingChecklistItem.findMany({
        where: { bookingId, userId, key: { in: [...BAND_GOAL_KEYS] } },
        select: { id: true, key: true, state: true },
      });

      const profile = await tx.userProfile.findUnique({
        where: { userId },
        select: { preferences: true },
      });
      const storedPreferences = profile?.preferences;
      const preferences =
        storedPreferences !== null && typeof storedPreferences === 'object' && !Array.isArray(storedPreferences)
          ? storedPreferences
          : {};
      const plan = planSoloExit({ goals, preferences });
      if (!plan) return false;
      const nextPreferences = plan.preferences as Prisma.InputJsonValue;

      await tx.userProfile.upsert({
        where: { userId },
        update: { preferences: nextPreferences },
        create: { userId, preferences: nextPreferences },
      });

      if (plan.goalIdsToSkip.length > 0) {
        await tx.bookingChecklistItem.updateMany({
          where: { id: { in: plan.goalIdsToSkip }, bookingId, userId, state: { in: ['PENDING', 'FAILED'] } }, // scoped-upstream: IDs were loaded under this booking and user above.
          data: { state: 'SKIPPED', completedAt: null },
        });
      }
      return true;
    });
  }

  /** Persist a service-computed goal reset plan; this method owns only Prisma writes. */
  async applyBandGoalResetPlan(
    userId: string,
    bookingId: string,
    goalId: string,
    plan: BandGoalResetPlan,
  ): Promise<void> {
    if (!plan.resetGoal && !plan.resetStepIds.length) return;
    const transaction: Prisma.PrismaPromise<unknown>[] = [];
    if (plan.resetGoal) {
      transaction.push(
        this.prisma.bookingChecklistItem.updateMany({
          where: { id: goalId, bookingId, userId, state: 'COMPLETE' },
          data: { state: 'PENDING', completedAt: null },
        }),
      );
    }
    if (plan.resetStepIds.length) {
      transaction.push(
        this.prisma.bookingChecklistStep.updateMany({
          where: { id: { in: plan.resetStepIds }, goalId, bookingId, userId, state: 'COMPLETE' },
          data: { state: 'PENDING', completedAt: null },
        }),
      );
    }
    transaction.push(
      this.prisma.bookingChecklistItem.updateMany({
        where: { id: goalId, bookingId, userId },
        data: { updatedAt: new Date() },
      }),
    );
    await this.prisma.$transaction(transaction);
  }

  // Un-stick a COMPLETE checklist key so the next evaluate() can recompute it (used when an
  // invoice is voided — the create-invoice key must drop back to PENDING). Handles both shapes
  // (ADR-0057): an un-migrated booking carries the key as a flat *goal*; a migrated one carries
  // it as a *step* of a multi-step goal. In the step case the parent goal is reset too — a
  // multi-step goal's state is a roll-up, and evaluate() skips terminal (COMPLETE) goals, so the
  // goal must be non-terminal for the roll-up to recompute from the now-PENDING step.
  async resetItemByKey(bookingId: string, key: string) {
    await this.prisma.bookingChecklistItem.updateMany({
      where: { bookingId, key, state: 'COMPLETE' },
      data: { state: 'PENDING', completedAt: null },
    });
    const step = await this.prisma.bookingChecklistStep.findFirst({
      where: { key, state: 'COMPLETE', goal: { bookingId } },
      select: { id: true, goalId: true },
    });
    if (!step) return;
    await this.prisma.$transaction([
      this.prisma.bookingChecklistStep.update({
        where: { id: step.id },
        data: { state: 'PENDING', completedAt: null },
      }),
      // Only a COMPLETE goal needs un-sticking; a SKIPPED goal (the musician opted out) stays
      // skipped, and a PENDING one is already recomputable.
      this.prisma.bookingChecklistItem.updateMany({
        where: { id: step.goalId, state: 'COMPLETE' },
        data: { state: 'PENDING', completedAt: null },
      }),
      // ADR-0076: a goal's `updatedAt` is the version of the goal AND its steps, so it must
      // move even when the un-stick above matched nothing (the goal was already non-terminal).
      // Otherwise this step reset is invisible to the client's per-goal response ordering.
      this.prisma.bookingChecklistItem.updateMany({
        where: { id: step.goalId }, // scoped-upstream: parent of the step row this same call writes, located via `goal: { bookingId }`
        data: { updatedAt: new Date() },
      }),
    ]);
  }

  // Persist goal-row and step-row state changes from one evaluation pass in a SINGLE
  // transaction. Goal state is a roll-up of its steps (ADR-0057), so a split write
  // would leave a window where a goal reads COMPLETE while a step is still PENDING.
  //
  // ADR-0076 INVARIANT — a goal's `updatedAt` is the version of the goal AND its steps.
  // The client orders concurrent checklist responses by it (per goal, newest wins), so a
  // step write whose parent row does not move is invisible to that ordering and silently
  // reintroduces #595. `buildGoalUpdate` returns null when the roll-up is unchanged, so a
  // step routinely changes without its parent appearing in `goalUpdates` — hence the
  // explicit touch below. ANY NEW STEP-WRITING PATH MUST DO THE SAME.
  async applyStateUpdates(
    goalUpdates: Array<{ id: string; state: string; completedAt?: Date | null }>,
    stepUpdates: Array<{ id: string; state: string; completedAt?: Date | null }>,
  ) {
    if (!goalUpdates.length && !stepUpdates.length) return;
    // Parentage is immutable, so resolving it outside the transaction is safe. Resolved HERE
    // rather than threaded in by the caller: the invariant then holds for every caller of this
    // method, present and future, instead of depending on each one remembering to pass it.
    const parents = stepUpdates.length
      ? await this.prisma.bookingChecklistStep.findMany({
          where: { id: { in: stepUpdates.map((s) => s.id) } },
          select: { goalId: true },
        })
      : [];
    const alreadyWritten = new Set(goalUpdates.map((g) => g.id));
    const toTouch = [...new Set(parents.map((p) => p.goalId))].filter((id) => !alreadyWritten.has(id));
    await this.prisma.$transaction([
      ...goalUpdates.map(({ id, state, completedAt }) =>
        this.prisma.bookingChecklistItem.update({
          where: { id },
          data: { state, ...(completedAt !== undefined ? { completedAt } : {}) },
        }),
      ),
      ...stepUpdates.map(({ id, state, completedAt }) =>
        this.prisma.bookingChecklistStep.update({
          where: { id },
          data: { state, ...(completedAt !== undefined ? { completedAt } : {}) },
        }),
      ),
      ...(toTouch.length
        ? [
            this.prisma.bookingChecklistItem.updateMany({
              where: { id: { in: toTouch } }, // scoped-upstream: parents of the step rows this same call writes; ownership proved by the evaluate() read that produced them
              data: { updatedAt: new Date() },
            }),
          ]
        : []),
    ]);
  }

  // The canonical steps of a system goal (ADR-0057). The BACKEND owns step structure:
  // step rows are always materialised from CHECKLIST_DEFAULTS by the goal's `key`, never
  // from the client payload — the create form only chooses which goals to seed. An
  // unkeyed (custom) goal or an atomic system goal has none.
  private canonicalStepsFor(key: string | null | undefined): ChecklistDefaultStep[] {
    if (!key) return [];
    return CHECKLIST_DEFAULTS.find((d) => d.key === key)?.steps ?? [];
  }

  private buildStepData(
    step: ChecklistDefaultStep,
    order: number,
    userId: string,
    bookingId: string,
    bandMemberId: string | null = null,
  ) {
    return {
      userId,
      bookingId,
      key: step.key,
      label: step.label,
      order,
      kind: step.kind,
      completeMode: step.completeMode,
      state: 'PENDING',
      completedBy: step.completedBy,
      bandMemberId,
      ...(step.autoCompleteRule != null
        ? { autoCompleteRule: step.autoCompleteRule as Prisma.InputJsonValue }
        : {}),
      ...(step.dueDateRule != null
        ? { dueDateRule: step.dueDateRule as unknown as Prisma.InputJsonValue }
        : {}),
    };
  }

  private buildGoalData(
    item: ChecklistItemSeed,
    order: number,
    userId: string,
    bookingId: string,
    bookingDate: Date,
    bookingCreatedAt: Date,
  ) {
    const dependsOn = item.dependsOn ?? [];
    const autoCompleteRule = item.autoCompleteRule ?? null;
    const dueDateRule = item.dueDateRule ?? null;
    return {
      userId,
      bookingId,
      key: item.key ?? null,
      label: item.label,
      completedBy: item.completedBy ?? 'USER',
      // ADR-0057 / #609: every goal seeds PENDING — BLOCKED retires. A multi-step goal rolls up
      // from PENDING steps; an atomic goal never hard-blocks (inter-goal order is soft status).
      // The create-time evaluate() then auto-completes any goal whose rule is already satisfied.
      state: 'PENDING',
      order,
      dependsOn,
      ...(autoCompleteRule !== null
        ? { autoCompleteRule: autoCompleteRule as Prisma.InputJsonValue }
        : {}),
      requiredForStatus: item.requiredForStatus ?? null,
      concern: item.concern ?? null,
      dueDate: computeDueDate(dueDateRule, bookingDate, bookingCreatedAt),
      ...(dueDateRule !== null
        ? { dueDateRule: dueDateRule as unknown as Prisma.InputJsonValue }
        : {}),
    };
  }

  async seedChecklistItems(
    userId: string,
    bookingId: string,
    defaults: ChecklistItemSeed[],
    bookingDate: Date,
    bookingCreatedAt: Date,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const steplessData: ReturnType<ChecklistRepository['buildGoalData']>[] = [];
    // Multi-step goals need a nested create (to materialise their step rows in the same
    // write); stepless goals batch via createMany. The global index keeps template order.
    for (let idx = 0; idx < defaults.length; idx++) {
      const item = defaults[idx];
      const steps = seedableChecklistSteps(this.canonicalStepsFor(item.key));
      if (steps.length > 0) {
        await client.bookingChecklistItem.create({
          data: {
            ...this.buildGoalData(item, idx + 1, userId, bookingId, bookingDate, bookingCreatedAt),
            steps: {
              create: steps.map((s, sIdx) => this.buildStepData(s, sIdx + 1, userId, bookingId)),
            },
          },
        });
      } else {
        steplessData.push(
          this.buildGoalData(item, idx + 1, userId, bookingId, bookingDate, bookingCreatedAt),
        );
      }
    }
    if (steplessData.length) {
      await client.bookingChecklistItem.createMany({ data: steplessData });
    }
  }

  // On-demand seed of a single system reminder (ADR-0052 / PRD #538 Module 4):
  // materialise one BookingChecklistItem from the defaults for a `key` that has no
  // record yet. Idempotent — if the key already exists on the booking it returns the
  // existing item untouched. The new item lands in template (workflow) position: the
  // tail of items at-or-after that position is shifted by +1, inside one transaction.
  async seedReminderItem(
    userId: string,
    bookingId: string,
    key: string,
    bookingDate: Date,
    bookingCreatedAt: Date,
  ): Promise<{ id: string } & Record<string, unknown>> {
    const existing = await this.prisma.bookingChecklistItem.findFirst({
      where: { bookingId, key },
    });
    if (existing) return existing;

    const def = CHECKLIST_DEFAULTS.find((d) => d.key === key);
    if (!def) {
      throw new Error(`Unknown reminder key: ${key}`);
    }

    const allItems = await this.prisma.bookingChecklistItem.findMany({
      where: { bookingId },
      select: { key: true, order: true },
    });
    const insertOrder = computeReminderInsertOrder(key, allItems);

    const dependsOn = def.dependsOn ?? [];
    const autoCompleteRule = def.autoCompleteRule ?? null;
    const dueDateRule = def.dueDateRule ?? null;
    const steps = seedableChecklistSteps(def.steps ?? []);

    return this.prisma.$transaction(async (tx) => {
      await tx.bookingChecklistItem.updateMany({
        where: { bookingId, order: { gte: insertOrder } },
        data: { order: { increment: 1 } },
      });
      return tx.bookingChecklistItem.create({
        data: {
          userId,
          bookingId,
          key: def.key,
          label: def.label,
          completedBy: def.completedBy ?? 'USER',
          // ADR-0057 / #609: BLOCKED retires — an on-demand-seeded goal always starts PENDING.
          state: 'PENDING',
          order: insertOrder,
          dependsOn,
          ...(autoCompleteRule !== null
            ? { autoCompleteRule: autoCompleteRule as Prisma.InputJsonValue }
            : {}),
          requiredForStatus: def.requiredForStatus ?? null,
          dueDate: computeDueDate(dueDateRule, bookingDate, bookingCreatedAt),
          ...(dueDateRule !== null
            ? { dueDateRule: dueDateRule as unknown as Prisma.InputJsonValue }
            : {}),
          ...(steps.length > 0
            ? { steps: { create: steps.map((s, sIdx) => this.buildStepData(s, sIdx + 1, userId, bookingId)) } }
            : {}),
        },
      });
    });
  }

  async recomputeChecklistDueDates(bookingId: string, bookingDate: Date, bookingCreatedAt: Date) {
    const items = await this.prisma.bookingChecklistItem.findMany({
      where: { bookingId },
      select: { id: true, dueDateRule: true },
    });
    const toUpdate = items.filter((item) => item.dueDateRule !== null);
    if (!toUpdate.length) return;
    await Promise.all(
      toUpdate.map((item) => {
        const rule = item.dueDateRule as { basis: 'bookingDate' | 'bookingCreation'; offsetDays: number };
        return this.prisma.bookingChecklistItem.update({
          where: { id: item.id },
          data: { dueDate: computeDueDate(rule, bookingDate, bookingCreatedAt) },
        });
      }),
    );
  }

  updateChecklistItemState(
    userId: string,
    bookingId: string,
    itemId: string,
    state: 'COMPLETE' | 'PENDING' | 'SKIPPED',
  ) {
    return this.prisma.bookingChecklistItem.updateMany({
      where: { id: itemId, bookingId, userId },
      data: {
        state,
        completedAt: state === 'COMPLETE' ? new Date() : null,
      },
    });
  }

  // Look up a single checklist item by its system `key` on a booking (used by the
  // enable-reminder flow to decide between un-skip and on-demand seed).
  findItemByKey(bookingId: string, key: string) {
    return this.prisma.bookingChecklistItem.findFirst({
      where: { bookingId, key },
      select: { id: true, state: true },
    });
  }
}
