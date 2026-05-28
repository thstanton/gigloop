import { Injectable } from '@nestjs/common';
import { ChecklistRepository } from './checklist.repository';

type AutoCompleteRule =
  | { type: 'bookingField'; field: string; operator: 'notNull' }
  | { type: 'communicationSent'; templateTypes: string[] }
  | { type: 'invoiceExists'; isDeposit: boolean }
  | { type: 'musicFormResponse' }
  | { type: 'contractSigned' };

interface BookingContext {
  status: string;
  depositReceivedAt: Date | null;
  communications: Array<{ status: string; template: { builtInType: string | null } | null }>;
  invoices: Array<{ isDeposit: boolean }>;
  contracts: Array<{ status: string }>;
  musicFormResponse: { id: string } | null;
}

const STATUS_ORDER = ['ENQUIRY', 'CONFIRMED', 'READY', 'COMPLETE', 'CANCELLED'];

function statusGte(current: string, threshold: string): boolean {
  return STATUS_ORDER.indexOf(current) >= STATUS_ORDER.indexOf(threshold);
}

// Items that become SKIPPED when booking status reaches a threshold
const SKIP_RULES: Array<{ keys: string[]; threshold: string }> = [
  { keys: ['send_quote'], threshold: 'CONFIRMED' },
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
  }
}

function isCommFailed(rule: AutoCompleteRule, ctx: BookingContext): boolean {
  if (rule.type !== 'communicationSent') return false;
  const matching = ctx.communications.filter((c) =>
    rule.templateTypes.includes(c.template?.builtInType ?? ''),
  );
  return matching.length > 0 && matching[matching.length - 1].status === 'FAILED';
}

@Injectable()
export class ChecklistEvaluatorService {
  constructor(private repo: ChecklistRepository) {}

  async evaluate(bookingId: string): Promise<void> {
    const { items, booking } = await this.repo.findItemsWithContext(bookingId);
    if (!booking || !items.length) return;

    // Build state map keyed by item key for dependency resolution
    const stateMap = new Map<string, string>();
    for (const item of items) {
      if (item.key) stateMap.set(item.key, item.state);
    }

    const updates: Array<{ id: string; state: string; completedAt?: Date | null }> = [];

    for (const item of items) {
      if (item.state === 'SKIPPED') continue;
      if (item.state === 'COMPLETE') continue; // COMPLETE is sticky

      // SKIPPED conditions from status
      const shouldSkip = SKIP_RULES.some(
        ({ keys, threshold }) =>
          item.key && keys.includes(item.key) && statusGte(booking.status, threshold),
      );
      if (shouldSkip) {
        updates.push({ id: item.id, state: 'SKIPPED' });
        if (item.key) stateMap.set(item.key, 'SKIPPED');
        continue;
      }

      const rule = item.autoCompleteRule as AutoCompleteRule | null;
      let newState: string;

      if (rule) {
        if (evaluateRule(rule, booking)) {
          newState = 'COMPLETE';
        } else if (isCommFailed(rule, booking)) {
          newState = 'FAILED';
        } else if (item.state === 'FAILED') {
          // Retry in progress but not yet succeeded — unblock based on deps
          const blocked = item.dependsOn.some((dep) => stateMap.get(dep) !== 'COMPLETE');
          newState = blocked ? 'BLOCKED' : 'PENDING';
        } else {
          const blocked = item.dependsOn.some((dep) => stateMap.get(dep) !== 'COMPLETE');
          newState = blocked ? 'BLOCKED' : 'PENDING';
        }
      } else {
        // Manual item — only track blocking state
        const blocked = item.dependsOn.some((dep) => stateMap.get(dep) !== 'COMPLETE');
        newState = blocked ? 'BLOCKED' : 'PENDING';
      }

      if (newState !== item.state) {
        const update: { id: string; state: string; completedAt?: Date | null } = {
          id: item.id,
          state: newState,
        };
        if (newState === 'COMPLETE') {
          update.completedAt = new Date();
        } else if (item.completedAt) {
          update.completedAt = null;
        }
        updates.push(update);
        if (item.key) stateMap.set(item.key, newState);
      }
    }

    if (updates.length) {
      await this.repo.updateItemStates(updates);
    }
  }
}
