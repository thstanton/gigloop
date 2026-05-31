import { Injectable } from '@nestjs/common';

@Injectable()
export class BookingActionsService {
  private inWindow(bookingDate: Date, today: Date, days: number | null, post: boolean): boolean {
    if (days === null) return false;
    const diff = Math.floor((bookingDate.getTime() - today.getTime()) / 86_400_000);
    return post ? diff >= -days && diff < 0 : diff >= 0 && diff <= days;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  computeActionItem(booking: any, profile: any, today: Date) {
    const bookingDate = new Date(booking.date);
    bookingDate.setHours(0, 0, 0, 0);

    const trackDeposit = true;
    const bookingDatePassed = bookingDate < today;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const comms: Array<{ status: string; template: { builtInType: string | null } | null }> = booking.communications;
    const invoices: Array<{ isDeposit: boolean; status: string }> = booking.invoices;
    const activeContract: { status: string; signedAt: Date | null } | null = booking.contracts?.[0] ?? null;

    const hasSent = (...types: string[]) =>
      comms.some((c) => types.includes(c.template?.builtInType ?? '') && c.status === 'SENT');
    const lastFailed = (...types: string[]) => {
      const rel = comms.filter((c) => types.includes(c.template?.builtInType ?? ''));
      return rel.length > 0 && rel[rel.length - 1].status === 'FAILED';
    };

    const gtEq = (s: string, target: string) =>
      ['CONFIRMED', 'READY', 'COMPLETE', 'CANCELLED'].slice(
        ['CONFIRMED', 'READY', 'COMPLETE', 'CANCELLED'].indexOf(target),
      ).includes(s);

    const contractSigned = activeContract?.status === 'SIGNED';

    const candidates = [
      { key: 'send_quote', label: 'Send quote', done: hasSent('quote'), failed: lastFailed('quote'), irrelevant: gtEq(booking.status, 'CONFIRMED') },
      { key: 'create_deposit_invoice', label: 'Create deposit invoice', done: invoices.some((i) => i.isDeposit), failed: false, irrelevant: !trackDeposit },
      { key: 'send_contract', label: 'Send contract & deposit email', done: hasSent('contract_cover', 'contract_and_deposit_cover'), failed: lastFailed('contract_cover', 'contract_and_deposit_cover'), irrelevant: contractSigned && (!!booking.depositReceivedAt || !trackDeposit) },
      { key: 'create_balance_invoice', label: 'Create balance invoice', done: invoices.some((i) => !i.isDeposit), failed: false, irrelevant: booking.status === 'ENQUIRY' },
      { key: 'music_form_invite', label: 'Send music form invite', done: hasSent('music_form_invite'), failed: lastFailed('music_form_invite'), irrelevant: !booking.musicFormConfig || booking.status === 'ENQUIRY' },
      { key: 'send_thank_you', label: 'Send thank you', done: hasSent('thank_you'), failed: lastFailed('thank_you'), irrelevant: !bookingDatePassed },
    ];

    const prefs = profile?.preferences as { reminderLeadDays?: number } | null;
    const reminderLeadDays = prefs?.reminderLeadDays ?? 7;

    for (const c of candidates) {
      if (c.irrelevant || c.done) continue;
      if (!this.inWindow(bookingDate, today, reminderLeadDays, c.key === 'send_thank_you')) continue;
      return { key: c.key, label: c.label, state: (c.failed ? 'failed' : 'outstanding') as 'failed' | 'outstanding' };
    }

    return null;
  }
}
