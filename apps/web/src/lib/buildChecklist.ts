import type { BookingDetail, Communication, Invoice } from '@/types/api';
import { statusGte } from '@/lib/constants';

export type ChecklistState = 'done' | 'outstanding' | 'failed';

export interface ChecklistItem {
  key: string;
  label: string;
  state: ChecklistState;
  shortcutTemplateType?: string;
  shortcutAction?: 'create_deposit_invoice' | 'create_balance_invoice';
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

  const trackDeposit = booking.depositTrackingMode !== 'NONE';

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
    shortcutType?: string;
    shortcutAction?: ChecklistItem['shortcutAction'];
  };

  const depositInvoiceExists = invoices.some((i) => i.isDeposit);
  const balanceInvoiceExists = invoices.some((i) => !i.isDeposit);
  const hasDepositInvoice = trackDeposit;
  const contractShortcutType = hasDepositInvoice ? 'contract_and_deposit_cover' : 'contract_cover';

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
      irrelevant: !trackDeposit || booking.status === 'ENQUIRY',
      shortcutAction: 'create_deposit_invoice',
    },
    {
      key: 'send_contract',
      label: 'Send contract & deposit email',
      done: hasSent('contract_cover', 'contract_and_deposit_cover'),
      failed: mostRecentFailed('contract_cover', 'contract_and_deposit_cover'),
      irrelevant:
        !!booking.contractSignedAt &&
        (!!booking.depositReceivedAt || !trackDeposit),
      shortcutType: contractShortcutType,
    },
    {
      key: 'contract_signed',
      label: 'Contract signed',
      done: !!booking.contractSignedAt,
      failed: false,
      irrelevant: booking.status === 'ENQUIRY' || statusGte(booking.status, 'SETTLED'),
    },
    {
      key: 'deposit_received',
      label: 'Deposit received',
      done: !!booking.depositReceivedAt,
      failed: false,
      irrelevant: !trackDeposit || booking.status === 'ENQUIRY',
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
    .map(({ key, label, done, failed, shortcutType, shortcutAction }) => ({
      key,
      label,
      state: (done ? 'done' : failed ? 'failed' : 'outstanding') as ChecklistState,
      shortcutTemplateType: shortcutType,
      shortcutAction,
    }));
}
