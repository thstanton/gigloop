import { BookingActionsService } from './bookings-actions.service';

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'b1',
    status: 'PROVISIONAL',
    date: new Date('2099-01-01'), // far future so not past
    depositReceivedAt: null,
    musicFormConfig: null,
    communications: [],
    invoices: [],
    contracts: [],
    customer: { name: 'Jane Smith' },
    venue: null,
    ...overrides,
  };
}

function today(offsetDays = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d;
}

function bookingInDays(days: number) {
  const d = today(days);
  return new Date(d);
}

describe('BookingActionsService', () => {
  let service: BookingActionsService;

  beforeEach(() => {
    service = new BookingActionsService();
  });

  describe('computeActionItem', () => {
    it('returns null when no action is due', () => {
      const booking = makeBooking({ date: bookingInDays(90) });
      expect(service.computeActionItem(booking, null, today())).toBeNull();
    });

    it('returns send_quote when booking is ENQUIRY with no quote sent and within window', () => {
      const booking = makeBooking({
        status: 'ENQUIRY',
        date: bookingInDays(5),
        communications: [],
      });
      const result = service.computeActionItem(booking, null, today());
      expect(result?.key).toBe('send_quote');
      expect(result?.state).toBe('outstanding');
    });

    it('returns create_deposit_invoice when no deposit invoice exists and within window', () => {
      const booking = makeBooking({
        status: 'PROVISIONAL',
        date: bookingInDays(5),
        communications: [
          { status: 'SENT', template: { builtInType: 'quote' } },
        ],
        invoices: [],
      });
      const result = service.computeActionItem(booking, null, today());
      expect(result?.key).toBe('create_deposit_invoice');
    });

    it('returns send_contract when quote and deposit invoice exist but contract not sent', () => {
      const booking = makeBooking({
        status: 'PROVISIONAL',
        date: bookingInDays(5),
        communications: [
          { status: 'SENT', template: { builtInType: 'quote' } },
        ],
        invoices: [{ isDeposit: true, status: 'SENT' }],
        contracts: [],
      });
      const result = service.computeActionItem(booking, null, today());
      expect(result?.key).toBe('send_contract');
    });

    it('marks failed state when last communication attempt for that type failed', () => {
      // send_quote: hasSent('quote') = false (no SENT), lastFailed = true → failed state
      const booking = makeBooking({
        status: 'ENQUIRY',
        date: bookingInDays(5),
        communications: [
          { status: 'FAILED', template: { builtInType: 'quote' } },
        ],
        invoices: [],
      });
      const result = service.computeActionItem(booking, null, today());
      expect(result?.key).toBe('send_quote');
      expect(result?.state).toBe('failed');
    });

    it('skips send_quote for CONFIRMED bookings', () => {
      const booking = makeBooking({
        status: 'CONFIRMED',
        date: bookingInDays(5),
        communications: [],
        invoices: [],
      });
      const result = service.computeActionItem(booking, null, today());
      // send_quote irrelevant for CONFIRMED; next is create_deposit_invoice
      expect(result?.key).toBe('create_deposit_invoice');
    });

    it('respects reminderLeadDays from profile preferences', () => {
      // Booking is 10 days away — outside default 7-day window
      const booking = makeBooking({
        status: 'ENQUIRY',
        date: bookingInDays(10),
        communications: [],
      });
      const noPrefsResult = service.computeActionItem(booking, null, today());
      expect(noPrefsResult).toBeNull();

      const withPrefsResult = service.computeActionItem(booking, { preferences: { reminderLeadDays: 14 } }, today());
      expect(withPrefsResult?.key).toBe('send_quote');
    });

    it('returns send_thank_you after the booking date has passed', () => {
      const booking = makeBooking({
        status: 'COMPLETE',
        date: bookingInDays(-3), // 3 days ago
        communications: [],
        invoices: [{ isDeposit: true, status: 'PAID' }, { isDeposit: false, status: 'PAID' }],
        contracts: [{ status: 'SIGNED', signedAt: new Date() }],
        musicFormConfig: null,
        depositReceivedAt: new Date(),
      });
      const result = service.computeActionItem(booking, { preferences: { reminderLeadDays: 7 } }, today());
      expect(result?.key).toBe('send_thank_you');
    });

    it('returns null when booking is far in the future (outside all windows)', () => {
      const booking = makeBooking({ date: bookingInDays(60), communications: [], invoices: [] });
      expect(service.computeActionItem(booking, null, today())).toBeNull();
    });
  });
});
