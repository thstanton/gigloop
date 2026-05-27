import type { BookingDetail, Communication, Invoice } from '@/types/api';
import { statusGte } from '@/lib/constants';

export type ChecklistState = 'done' | 'outstanding' | 'failed' | 'blocked';

export interface ChecklistItem {
  key: string;
  label: string;
  state: ChecklistState;
  hint?: string;
  shortcutTemplateType?: string;
  shortcutAction?: 'create_deposit_invoice' | 'create_balance_invoice';
  shortcutMarkDone?: 'mark_contract_signed' | 'mark_deposit_received';
}

export function buildChecklist(
  booking: BookingDetail,
  communications: Communication[],
  invoices: Invoice[] = [],
): ChecklistItem[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const bookingDate = new Date(booking.date);
  bookingDate.setHours(0, 0, 0, 0);
  const bookingDatePassed = bookingDate < today;

  const resolvedDepositMode = booking.depositTrackingMode ?? 'INVOICE';
  const trackDeposit = resolvedDepositMode !== 'NONE';

  const hasSent = (...types: string[]) =>
    communications.some((c) => types.includes(c.template?.builtInType ?? '') && c.status === 'SENT');

  const mostRecentFailed = (...types: string[]) => {
    const relevant = communications.filter((c) => types.includes(c.template?.builtInType ?? ''));
    if (relevant.length === 0) return false;
    const sorted = [...relevant].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return sorted[0].status === 'FAILED';
  };

  type RawItem = {
    key: string;
    label: string;
    done: boolean;
    failed: boolean;
    irrelevant: boolean;
    blocked?: boolean;
    hint?: string;
    shortcutType?: string;
    shortcutAction?: ChecklistItem['shortcutAction'];
    shortcutMarkDone?: ChecklistItem['shortcutMarkDone'];
  };

  const depositInvoiceExists = invoices.some((i) => i.isDeposit);
  const balanceInvoiceExists = invoices.some((i) => !i.isDeposit);
  const contractShortcutType = trackDeposit ? 'contract_and_deposit_cover' : 'contract_cover';

  const raw: RawItem[] = [
    {
      key: 'send_quote',
      label: 'Send quote',
      done: hasSent('quote'),
      failed: mostRecentFailed('quote'),
      irrelevant: statusGte(booking.status, 'CONFIRMED'),
      shortcutType: 'quote',
    },
    {
      key: 'create_deposit_invoice',
      label: 'Create deposit invoice',
      done: depositInvoiceExists,
      failed: false,
      irrelevant: !trackDeposit,
      shortcutAction: 'create_deposit_invoice',
    },
    {
      key: 'create_contract',
      label: 'Create contract',
      done: booking.activeContract !== null,
      failed: false,
      irrelevant: booking.activeContract?.status === 'SIGNED',
    },
    {
      key: 'send_contract',
      label: 'Send contract & deposit email',
      done: hasSent('contract_cover', 'contract_and_deposit_cover'),
      failed: mostRecentFailed('contract_cover', 'contract_and_deposit_cover'),
      irrelevant:
        booking.activeContract?.status === 'SIGNED' &&
        (!!booking.depositReceivedAt || !trackDeposit),
      blocked: booking.activeContract === null,
      hint: 'Create a contract first',
      shortcutType: contractShortcutType,
    },
    {
      key: 'contract_signed',
      label: 'Contract signed',
      done: booking.activeContract?.status === 'SIGNED',
      failed: false,
      irrelevant: booking.status === 'ENQUIRY' || statusGte(booking.status, 'READY'),
      shortcutMarkDone: 'mark_contract_signed',
    },
    {
      key: 'deposit_received',
      label: 'Deposit received',
      done: !!booking.depositReceivedAt,
      failed: false,
      irrelevant: !trackDeposit || booking.status === 'ENQUIRY',
      shortcutMarkDone: 'mark_deposit_received',
    },
    {
      key: 'create_balance_invoice',
      label: 'Create balance invoice',
      done: balanceInvoiceExists,
      failed: false,
      irrelevant: booking.status === 'ENQUIRY',
      shortcutAction: 'create_balance_invoice',
    },
    {
      key: 'music_form_invite',
      label: 'Send music form invite',
      done: hasSent('music_form_invite'),
      failed: mostRecentFailed('music_form_invite'),
      irrelevant: !booking.hasMusicFormConfig || booking.status === 'ENQUIRY',
      shortcutType: 'music_form_invite',
    },
    {
      key: 'song_requests',
      label: 'Song requests received',
      done: booking.hasMusicFormResponse,
      failed: false,
      irrelevant: !booking.hasMusicFormConfig || !hasSent('music_form_invite'),
    },
    {
      key: 'send_thank_you',
      label: 'Send thank you',
      done: hasSent('thank_you'),
      failed: mostRecentFailed('thank_you'),
      irrelevant: !bookingDatePassed,
      shortcutType: 'thank_you',
    },
  ];

  return raw
    .filter((item) => !item.irrelevant)
    .map(({ key, label, done, failed, blocked, hint, shortcutType, shortcutAction, shortcutMarkDone }) => ({
      key,
      label,
      state: (done ? 'done' : blocked ? 'blocked' : failed ? 'failed' : 'outstanding') as ChecklistState,
      hint: blocked ? hint : undefined,
      shortcutTemplateType: shortcutType,
      shortcutAction,
      shortcutMarkDone,
    }));
}
