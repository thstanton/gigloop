import { Injectable } from '@nestjs/common';
import { ChecklistRepository } from './checklist.repository';
import { isConcernComplete, CompletenessConcern } from '../bookings/booking-completeness';

type AutoCompleteRule =
  | { type: 'bookingField'; field: string; operator: 'notNull' }
  | { type: 'communicationSent'; templateTypes: string[] }
  | { type: 'invoiceExists'; isDeposit: boolean }
  | { type: 'musicFormResponse' }
  | { type: 'contractSigned' }
  | { type: 'completeness'; concern: CompletenessConcern };

interface BookingContext {
  status: string;
  venueId: string | null;
  customerId: string | null;
  depositReceivedAt: Date | null;
  setsCount: number;
  logistics: unknown;
  communications: Array<{ status: string; template: { builtInType: string | null } | null }>;
  invoices: Array<{ isDeposit: boolean }>;
  contracts: Array<{ status: string }>;
  musicFormResponse: { id: string } | null;
}

const STATUS_ORDER = ['ENQUIRY', 'PROVISIONAL', 'CONFIRMED', 'READY', 'COMPLETE', 'CANCELLED'];

function statusGte(current: string, threshold: string): boolean {
  return STATUS_ORDER.indexOf(current) >= STATUS_ORDER.indexOf(threshold);
}

// Items that become SKIPPED when booking status reaches a threshold
const SKIP_RULES: Array<{ keys: string[]; threshold: string }> = [
  { keys: ['contract_signed'], threshold: 'READY' },
];

function evaluateRule(rule: AutoCompleteRule, ctx: BookingContext): boolean {
  switch (rule.type) {
    case 'bookingField':
      if (rule.field === 'depositReceivedAt') return ctx.depositReceivedAt !== null;
      if (rule.field === 'activeContract') return ctx.contracts.length > 0;
      return false;
    case 'communicationSent':
      return ctx.communications.some(
        (c) => c.status === 'SENT' && rule.templateTypes.includes(c.template?.builtInType ?? ''),
      );
    case 'invoiceExists':
      return ctx.invoices.some((i) => i.isDeposit === rule.isDeposit);
    case 'musicFormResponse':
      return ctx.musicFormResponse !== null;
    case 'contractSigned':
      return ctx.contracts.some((c) => c.status === 'SIGNED');
    // Structural items (Module D) bind their done-state to a completeness predicate
    // (Module A), so "is this concern done?" lives in exactly one place.
    case 'completeness':
      return isConcernComplete(rule.concern, ctx);
  }
}

function isCommFailed(rule: AutoCompleteRule, ctx: BookingContext): boolean {
  if (rule.type !== 'communicationSent') return false;
  const matching = ctx.communications.filter((c) =>
    rule.templateTypes.includes(c.template?.builtInType ?? ''),
  );
  return matching.length > 0 && matching[matching.length - 1].status === 'FAILED';
}

type ChecklistItem = {
  id: string;
  key: string | null;
  state: string;
  completedAt: Date | null;
  dependsOn: string[];
  autoCompleteRule: unknown;
};

function buildStateMap(items: ChecklistItem[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of items) {
    if (item.key) map.set(item.key, item.state);
  }
  return map;
}

function resolveSkip(item: ChecklistItem, bookingStatus: string): boolean {
  return SKIP_RULES.some(
    ({ keys, threshold }) =>
      item.key && keys.includes(item.key) && statusGte(bookingStatus, threshold),
  );
}

function resolveNewState(item: ChecklistItem, booking: BookingContext, stateMap: Map<string, string>): string {
  const rule = item.autoCompleteRule as AutoCompleteRule | null;
  const blocked = item.dependsOn.some((dep) => stateMap.get(dep) !== 'COMPLETE');

  if (!rule) return blocked ? 'BLOCKED' : 'PENDING';
  if (evaluateRule(rule, booking)) return 'COMPLETE';
  if (isCommFailed(rule, booking)) return 'FAILED';
  return blocked ? 'BLOCKED' : 'PENDING';
}

function buildItemUpdate(
  item: ChecklistItem,
  booking: BookingContext,
  stateMap: Map<string, string>,
): { id: string; state: string; completedAt?: Date | null } | null {
  const newState = resolveNewState(item, booking, stateMap);
  if (newState === item.state) return null;
  const update: { id: string; state: string; completedAt?: Date | null } = { id: item.id, state: newState };
  if (newState === 'COMPLETE') update.completedAt = new Date();
  else if (item.completedAt) update.completedAt = null;
  return update;
}

function evaluateItem(
  item: ChecklistItem,
  booking: BookingContext,
  stateMap: Map<string, string>,
): { id: string; state: string; completedAt?: Date | null } | null {
  if (resolveSkip(item, booking.status)) return { id: item.id, state: 'SKIPPED' };
  return buildItemUpdate(item, booking, stateMap);
}

function computeUpdates(
  items: ChecklistItem[],
  booking: BookingContext,
  stateMap: Map<string, string>,
): Array<{ id: string; state: string; completedAt?: Date | null }> {
  const updates: Array<{ id: string; state: string; completedAt?: Date | null }> = [];
  for (const item of items) {
    if (item.state === 'SKIPPED' || item.state === 'COMPLETE') continue;
    const update = evaluateItem(item, booking, stateMap);
    if (update) {
      updates.push(update);
      if (item.key) stateMap.set(item.key, update.state);
    }
  }
  return updates;
}

@Injectable()
export class ChecklistEvaluatorService {
  constructor(private repo: ChecklistRepository) {}

  async evaluate(bookingId: string): Promise<void> {
    const { items, booking } = await this.repo.findItemsWithContext(bookingId);
    if (!booking || !items.length) return;
    const stateMap = buildStateMap(items);
    const updates = computeUpdates(items, booking, stateMap);
    if (updates.length) await this.repo.updateItemStates(updates);
  }
}
