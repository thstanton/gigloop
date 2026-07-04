import { deriveShortcut } from './bookings.service';

describe('deriveShortcut', () => {
  it('maps the send_balance_invoice rule to a send_email/balance_invoice_cover shortcut (#586)', () => {
    expect(
      deriveShortcut({ type: 'communicationSent', templateTypes: ['balance_invoice_cover'] }, []),
    ).toEqual({ shortcutType: 'send_email', shortcutTemplateType: 'balance_invoice_cover' });
  });

  it('maps a generic communicationSent rule to its first template type', () => {
    expect(
      deriveShortcut({ type: 'communicationSent', templateTypes: ['quote'] }, []),
    ).toEqual({ shortcutType: 'send_email', shortcutTemplateType: 'quote' });
  });

  it('maps a balance invoicePaid rule to the mark_balance_received shortcut (#653)', () => {
    expect(deriveShortcut({ type: 'invoicePaid', isDeposit: false }, [])).toEqual({
      shortcutType: 'mark_balance_received',
    });
  });

  it('maps a deposit invoicePaid rule to the mark_deposit_received shortcut (#653)', () => {
    expect(deriveShortcut({ type: 'invoicePaid', isDeposit: true }, [])).toEqual({
      shortcutType: 'mark_deposit_received',
    });
  });

  it('returns no shortcut for a null rule', () => {
    expect(deriveShortcut(null, [])).toEqual({});
  });
});
