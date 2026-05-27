import { describe, it, expect, beforeEach } from 'vitest';
import { buildChecklist } from './buildChecklist';
import type { BookingDetail, Communication, CommunicationStatus } from '@/types/api';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeBooking(overrides: Partial<BookingDetail> = {}): BookingDetail {
  return {
    id: 'b1',
    userId: 'u1',
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
    title: null,
    date: '2025-08-15',
    status: 'CONFIRMED',
    eventType: 'WEDDING',
    fee: null,
    notes: null,
    contractSignedAt: null,
    depositReceivedAt: null,
    depositTrackingMode: 'INVOICE',
    portalToken: 'tok',
    hasMusicFormConfig: false,
    hasMusicFormResponse: false,
    customerId: 'c1',
    customer: { id: 'c1', createdAt: '', updatedAt: '', name: 'Jane', greetingName: null, email: null, phone: null,
      address: null, notes: null, parkingInfo: null, accessInfo: null, equipmentAvailable: null,
      website: null, commissionArrangement: null },
    venueId: null,
    venue: null,
    referrerId: null,
    referrer: null,
    sets: [],
    ...overrides,
  } as unknown as BookingDetail;
}

let commCounter = 0;
function makeComm(
  builtInType: string | null,
  status: CommunicationStatus,
  createdAt = `2025-06-${String(++commCounter).padStart(2, '0')}`,
): Communication {
  return {
    id: `comm-${commCounter}`,
    createdAt,
    updatedAt: createdAt,
    direction: 'OUTBOUND',
    channel: 'EMAIL',
    status,
    subject: 'Subject',
    body: '<p>body</p>',
    sentAt: status === 'SENT' ? createdAt : null,
    bookingId: 'b1',
    contactId: 'c1',
    contact: { id: 'c1', createdAt: '', updatedAt: '', name: 'Jane', greetingName: null, email: null, phone: null,
      address: null, notes: null, parkingInfo: null, accessInfo: null, equipmentAvailable: null,
      website: null, commissionArrangement: null },
    templateId: null,
    template: builtInType ? { id: 'tmpl1', createdAt: '', updatedAt: '', name: builtInType, content: {}, builtInType: builtInType as never } : null,
  };
}

beforeEach(() => { commCounter = 0; });

function getItem(items: ReturnType<typeof buildChecklist>, key: string) {
  return items.find((i) => i.key === key);
}

// ─── send_quote ───────────────────────────────────────────────────────────────

describe('send_quote', () => {
  it('is outstanding when no quote communication exists', () => {
    const items = buildChecklist(makeBooking({ status: 'ENQUIRY' }), []);
    expect(getItem(items, 'send_quote')?.state).toBe('outstanding');
  });

  it('is done when a SENT quote communication exists', () => {
    const items = buildChecklist(makeBooking({ status: 'ENQUIRY' }), [makeComm('quote', 'SENT')]);
    expect(getItem(items, 'send_quote')?.state).toBe('done');
  });

  it('is failed when the most recent quote communication is FAILED', () => {
    const items = buildChecklist(makeBooking({ status: 'ENQUIRY' }), [makeComm('quote', 'FAILED')]);
    expect(getItem(items, 'send_quote')?.state).toBe('failed');
  });

  it('is done when a later SENT communication follows a FAILED one', () => {
    const failed = makeComm('quote', 'FAILED', '2025-06-01');
    const sent = makeComm('quote', 'SENT', '2025-06-02');
    const items = buildChecklist(makeBooking({ status: 'ENQUIRY' }), [failed, sent]);
    expect(getItem(items, 'send_quote')?.state).toBe('done');
  });

  it('is not done for a PENDING quote communication', () => {
    const items = buildChecklist(makeBooking({ status: 'ENQUIRY' }), [makeComm('quote', 'PENDING')]);
    expect(getItem(items, 'send_quote')?.state).not.toBe('done');
  });

  it('is irrelevant (hidden) when booking is CONFIRMED or beyond', () => {
    for (const status of ['CONFIRMED', 'READY', 'COMPLETE', 'CANCELLED'] as const) {
      const items = buildChecklist(makeBooking({ status }), []);
      expect(getItem(items, 'send_quote')).toBeUndefined();
    }
  });

  it('has a shortcut template type', () => {
    const items = buildChecklist(makeBooking({ status: 'ENQUIRY' }), []);
    expect(getItem(items, 'send_quote')?.shortcutTemplateType).toBe('quote');
  });
});

// ─── send_contract ────────────────────────────────────────────────────────────

describe('send_contract', () => {
  it('is outstanding when no contract communication exists', () => {
    const items = buildChecklist(makeBooking(), []);
    expect(getItem(items, 'send_contract')?.state).toBe('outstanding');
  });

  it('is done when a SENT contract_cover communication exists', () => {
    const items = buildChecklist(makeBooking(), [makeComm('contract_cover', 'SENT')]);
    expect(getItem(items, 'send_contract')?.state).toBe('done');
  });

  it('is done when a SENT contract_and_deposit_cover communication exists', () => {
    const items = buildChecklist(makeBooking(), [makeComm('contract_and_deposit_cover', 'SENT')]);
    expect(getItem(items, 'send_contract')?.state).toBe('done');
  });

  it('is failed when the most recent relevant communication is FAILED', () => {
    const items = buildChecklist(makeBooking(), [makeComm('contract_and_deposit_cover', 'FAILED')]);
    expect(getItem(items, 'send_contract')?.state).toBe('failed');
  });

  it('is irrelevant when contract signed and deposit received', () => {
    const booking = makeBooking({ contractSignedAt: '2025-06-01', depositReceivedAt: '2025-06-02' });
    const items = buildChecklist(booking, []);
    expect(getItem(items, 'send_contract')).toBeUndefined();
  });

  it('is irrelevant when contract signed and deposit tracking is NONE', () => {
    const booking = makeBooking({ contractSignedAt: '2025-06-01', depositTrackingMode: 'NONE' });
    const items = buildChecklist(booking, []);
    expect(getItem(items, 'send_contract')).toBeUndefined();
  });

  it('is still visible when contract signed but deposit not yet received and tracking is active', () => {
    const booking = makeBooking({ contractSignedAt: '2025-06-01', depositTrackingMode: 'INVOICE' });
    const items = buildChecklist(booking, []);
    expect(getItem(items, 'send_contract')).toBeDefined();
  });

  it('shortcut is contract_and_deposit_cover when deposit tracking is active', () => {
    const items = buildChecklist(makeBooking({ depositTrackingMode: 'INVOICE' }), []);
    expect(getItem(items, 'send_contract')?.shortcutTemplateType).toBe('contract_and_deposit_cover');
  });

  it('shortcut is contract_cover when deposit tracking is NONE', () => {
    const items = buildChecklist(makeBooking({ depositTrackingMode: 'NONE' }), []);
    expect(getItem(items, 'send_contract')?.shortcutTemplateType).toBe('contract_cover');
  });
});

// ─── contract_signed ─────────────────────────────────────────────────────────

describe('contract_signed', () => {
  it('is outstanding when contractSignedAt is null', () => {
    const items = buildChecklist(makeBooking({ status: 'CONFIRMED' }), []);
    expect(getItem(items, 'contract_signed')?.state).toBe('outstanding');
  });

  it('is done when contractSignedAt is set', () => {
    const booking = makeBooking({ status: 'CONFIRMED', contractSignedAt: '2025-06-01' });
    const items = buildChecklist(booking, []);
    expect(getItem(items, 'contract_signed')?.state).toBe('done');
  });

  it('is irrelevant at ENQUIRY status', () => {
    const items = buildChecklist(makeBooking({ status: 'ENQUIRY' }), []);
    expect(getItem(items, 'contract_signed')).toBeUndefined();
  });

  it('is irrelevant at READY status and beyond', () => {
    for (const status of ['READY', 'COMPLETE', 'CANCELLED'] as const) {
      const items = buildChecklist(makeBooking({ status }), []);
      expect(getItem(items, 'contract_signed')).toBeUndefined();
    }
  });

  it('has no shortcut template type', () => {
    const items = buildChecklist(makeBooking({ status: 'CONFIRMED' }), []);
    expect(getItem(items, 'contract_signed')?.shortcutTemplateType).toBeUndefined();
  });

  it('has shortcutMarkDone mark_contract_signed when outstanding', () => {
    const items = buildChecklist(makeBooking({ status: 'CONFIRMED' }), []);
    expect(getItem(items, 'contract_signed')?.shortcutMarkDone).toBe('mark_contract_signed');
  });
});

// ─── deposit_received ─────────────────────────────────────────────────────────

describe('deposit_received', () => {
  it('is outstanding when depositReceivedAt is null and tracking is active', () => {
    const items = buildChecklist(makeBooking({ depositTrackingMode: 'INVOICE' }), []);
    expect(getItem(items, 'deposit_received')?.state).toBe('outstanding');
  });

  it('is done when depositReceivedAt is set', () => {
    const booking = makeBooking({ depositReceivedAt: '2025-06-01' });
    const items = buildChecklist(booking, []);
    expect(getItem(items, 'deposit_received')?.state).toBe('done');
  });

  it('is irrelevant when deposit tracking is NONE', () => {
    const items = buildChecklist(makeBooking({ depositTrackingMode: 'NONE' }), []);
    expect(getItem(items, 'deposit_received')).toBeUndefined();
  });

  it('is irrelevant at ENQUIRY status', () => {
    const items = buildChecklist(makeBooking({ status: 'ENQUIRY', depositTrackingMode: 'INVOICE' }), []);
    expect(getItem(items, 'deposit_received')).toBeUndefined();
  });

  it('has shortcutMarkDone mark_deposit_received for INVOICE mode', () => {
    const items = buildChecklist(makeBooking({ depositTrackingMode: 'INVOICE' }), []);
    expect(getItem(items, 'deposit_received')?.shortcutMarkDone).toBe('mark_deposit_received');
  });

  it('has shortcutMarkDone mark_deposit_received when depositTrackingMode is null (inherits INVOICE default)', () => {
    const items = buildChecklist(makeBooking({ depositTrackingMode: null }), []);
    expect(getItem(items, 'deposit_received')?.shortcutMarkDone).toBe('mark_deposit_received');
  });

  it('has shortcutMarkDone mark_deposit_received for MANUAL mode', () => {
    const items = buildChecklist(makeBooking({ depositTrackingMode: 'MANUAL' }), []);
    expect(getItem(items, 'deposit_received')?.shortcutMarkDone).toBe('mark_deposit_received');
  });
});

// ─── music_form_invite ────────────────────────────────────────────────────────

describe('music_form_invite', () => {
  it('is irrelevant when no music form config on booking', () => {
    const items = buildChecklist(makeBooking({ hasMusicFormConfig: false }), []);
    expect(getItem(items, 'music_form_invite')).toBeUndefined();
  });

  it('is outstanding when config exists but no invite sent', () => {
    const items = buildChecklist(makeBooking({ hasMusicFormConfig: true }), []);
    expect(getItem(items, 'music_form_invite')?.state).toBe('outstanding');
  });

  it('is done when a SENT music_form_invite communication exists', () => {
    const booking = makeBooking({ hasMusicFormConfig: true });
    const items = buildChecklist(booking, [makeComm('music_form_invite', 'SENT')]);
    expect(getItem(items, 'music_form_invite')?.state).toBe('done');
  });

  it('is failed when the most recent invite is FAILED', () => {
    const booking = makeBooking({ hasMusicFormConfig: true });
    const items = buildChecklist(booking, [makeComm('music_form_invite', 'FAILED')]);
    expect(getItem(items, 'music_form_invite')?.state).toBe('failed');
  });

  it('is irrelevant at ENQUIRY status even with config', () => {
    const items = buildChecklist(makeBooking({ hasMusicFormConfig: true, status: 'ENQUIRY' }), []);
    expect(getItem(items, 'music_form_invite')).toBeUndefined();
  });

  it('has shortcutTemplateType of music_form_invite', () => {
    const items = buildChecklist(makeBooking({ hasMusicFormConfig: true }), []);
    expect(getItem(items, 'music_form_invite')?.shortcutTemplateType).toBe('music_form_invite');
  });
});

// ─── song_requests ────────────────────────────────────────────────────────────

describe('song_requests', () => {
  it('is irrelevant when no music form config', () => {
    const items = buildChecklist(makeBooking({ hasMusicFormConfig: false }), []);
    expect(getItem(items, 'song_requests')).toBeUndefined();
  });

  it('is irrelevant when config exists but no invite has been SENT', () => {
    const booking = makeBooking({ hasMusicFormConfig: true });
    const items = buildChecklist(booking, [makeComm('music_form_invite', 'FAILED')]);
    expect(getItem(items, 'song_requests')).toBeUndefined();
  });

  it('is outstanding when invite was SENT but no response', () => {
    const booking = makeBooking({ hasMusicFormConfig: true, hasMusicFormResponse: false });
    const items = buildChecklist(booking, [makeComm('music_form_invite', 'SENT')]);
    expect(getItem(items, 'song_requests')?.state).toBe('outstanding');
  });

  it('is done when hasMusicFormResponse is true', () => {
    const booking = makeBooking({ hasMusicFormConfig: true, hasMusicFormResponse: true });
    const items = buildChecklist(booking, [makeComm('music_form_invite', 'SENT')]);
    expect(getItem(items, 'song_requests')?.state).toBe('done');
  });
});

// ─── send_thank_you ───────────────────────────────────────────────────────────

describe('send_thank_you', () => {
  const pastBooking = makeBooking({ date: '2020-01-01' });
  const futureBooking = makeBooking({ date: '2099-01-01' });

  it('is irrelevant when booking date is in the future', () => {
    const items = buildChecklist(futureBooking, []);
    expect(getItem(items, 'send_thank_you')).toBeUndefined();
  });

  it('is outstanding when booking date has passed and no thank_you sent', () => {
    const items = buildChecklist(pastBooking, []);
    expect(getItem(items, 'send_thank_you')?.state).toBe('outstanding');
  });

  it('is done when a SENT thank_you communication exists', () => {
    const items = buildChecklist(pastBooking, [makeComm('thank_you', 'SENT')]);
    expect(getItem(items, 'send_thank_you')?.state).toBe('done');
  });

  it('is failed when the most recent thank_you communication is FAILED', () => {
    const items = buildChecklist(pastBooking, [makeComm('thank_you', 'FAILED')]);
    expect(getItem(items, 'send_thank_you')?.state).toBe('failed');
  });

  it('has shortcutTemplateType of thank_you', () => {
    const items = buildChecklist(pastBooking, []);
    expect(getItem(items, 'send_thank_you')?.shortcutTemplateType).toBe('thank_you');
  });
});

// ─── CANCELLED bookings ───────────────────────────────────────────────────────

describe('CANCELLED booking', () => {
  it('buildChecklist still runs without error (caller is responsible for hiding the list)', () => {
    const booking = makeBooking({ status: 'CANCELLED' });
    expect(() => buildChecklist(booking, [])).not.toThrow();
  });
});

// ─── PENDING communications ───────────────────────────────────────────────────

describe('PENDING communications', () => {
  it('are not treated as Done for any checklist item', () => {
    const booking = makeBooking({ status: 'ENQUIRY', hasMusicFormConfig: true });
    const pending = [
      makeComm('quote', 'PENDING'),
      makeComm('contract_cover', 'PENDING'),
      makeComm('music_form_invite', 'PENDING'),
    ];
    const items = buildChecklist(booking, pending);
    for (const item of items) {
      expect(item.state).not.toBe('done');
    }
  });
});
