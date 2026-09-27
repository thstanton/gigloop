import { buildBandInviteCalendar } from './band-invite-calendar';

const baseEvent = {
  bookingId: 'booking-1',
  contactId: 'contact-1',
  bookingDate: new Date('2026-09-15T00:00:00.000Z'),
  title: 'Autumn wedding',
  venueName: 'The Hall',
  venueAddress: '1 High Street, Bath',
  portalUrl: 'https://app.gigloop.com/band/token-1',
  appUrl: 'https://app.gigloop.com',
  musicianName: 'A. Musician',
  musicianEmail: 'musician@example.com',
  setsSchedule: '18:00 — Drinks (45 min)\n20:00 — Reception (60 min)',
  packages: [
    { id: 'drinks', order: 1 },
    { id: 'reception', order: 2 },
  ],
  playedPackageIds: ['drinks', 'reception'],
  sets: [
    { packageId: 'drinks', startTime: '18:00', duration: 45, order: 1 },
    { packageId: 'reception', startTime: '20:00', duration: 60, order: 2 },
  ],
  generatedAt: new Date('2026-08-01T12:34:56.000Z'),
};

describe('buildBandInviteCalendar', () => {
  it('uses floating time from the earliest played segment through the end of the last one', () => {
    const calendar = buildBandInviteCalendar({
      ...baseEvent,
      sets: [
        { packageId: 'drinks', startTime: '18:00', duration: 45, order: 1 },
        { packageId: 'drinks', startTime: '17:30', duration: 20, order: 2 },
        { packageId: 'reception', startTime: '20:00', duration: 60, order: 3 },
        { packageId: 'drinks', startTime: '21:00', duration: 10, order: 4 },
        { packageId: 'not-played', startTime: '12:00', duration: 30, order: 0 },
      ],
    });
    const unfolded = calendar.replace(/\r\n /g, '');

    expect(calendar).toContain('DTSTART:20260915T173000');
    expect(calendar).toContain('DTEND:20260915T211000');
    expect(calendar).toContain('UID:booking-1.contact-1@app.gigloop.com');
    expect(calendar).toContain('DTSTAMP:20260801T123456Z');
    expect(calendar).toContain('SUMMARY:Autumn wedding');
    expect(calendar).toContain('LOCATION:The Hall\\, 1 High Street\\, Bath');
    expect(calendar).toContain('URL:https://app.gigloop.com/band/token-1');
    expect(unfolded).toContain('DESCRIPTION:Band portal: https://app.gigloop.com/band/token-1\\nContact: A. Musician (musician@example.com)\\nPerformance schedule:\\n18:00 — Drinks (45 min)\\n20:00 — Reception (60 min)');
  });

  it('keeps the UID stable for a fresh member row re-inviting the same contact', () => {
    const firstInvite = buildBandInviteCalendar(baseEvent);
    const reInvite = buildBandInviteCalendar({ ...baseEvent, generatedAt: new Date('2026-08-02T00:00:00Z') });

    expect(/^UID:.*$/m.exec(firstInvite)?.[0]).toBe('UID:booking-1.contact-1@app.gigloop.com');
    expect(/^UID:.*$/m.exec(reInvite)?.[0]).toBe('UID:booking-1.contact-1@app.gigloop.com');
  });

  it('uses a valid all-day event when none of the member’s played sets has a time', () => {
    const calendar = buildBandInviteCalendar({
      ...baseEvent,
      sets: [{ packageId: 'drinks', startTime: null, duration: 45, order: 1 }],
    });

    expect(calendar).toContain('DTSTART;VALUE=DATE:20260915');
    expect(calendar).toContain('DTEND;VALUE=DATE:20260916');
    expect(calendar).not.toContain('DTSTART:20260915T');
  });

  it('omits iTIP scheduling properties and emits CRLF-terminated lines', () => {
    const calendar = buildBandInviteCalendar(baseEvent);

    expect(calendar).not.toMatch(/^(METHOD|ORGANIZER|ATTENDEE|SEQUENCE|VTIMEZONE)(?:[:;])/m);
    expect(calendar).toMatch(/\r\n$/);
    expect(calendar.split('\r\n').every((line) => Buffer.byteLength(line, 'utf8') <= 75)).toBe(true);
  });

  it('escapes text values and folds long UTF-8 lines without exceeding 75 octets', () => {
    const calendar = buildBandInviteCalendar({
      ...baseEvent,
      title: `A very long wedding title, with punctuation; ${'🎷'.repeat(24)}`,
      venueAddress: 'Flat 2; 1 High Street, Bath',
    });

    expect(calendar).toContain('SUMMARY:A very long wedding title\\, with punctuation\\;');
    expect(calendar).toContain('LOCATION:The Hall\\, Flat 2\\; 1 High Street\\, Bath');
    expect(calendar.split('\r\n').every((line) => Buffer.byteLength(line, 'utf8') <= 75)).toBe(true);
    expect(calendar).toMatch(/\r\n /);
  });
});
