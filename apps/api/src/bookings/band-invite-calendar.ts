type CalendarSet = {
  packageId: string | null;
  startTime: string | null;
  duration: number;
  order: number;
};

export interface BandInviteCalendarInput {
  bookingId: string;
  contactId: string;
  bookingDate: Date;
  title: string | null;
  venueName: string | null;
  venueAddress: string | null;
  portalUrl: string;
  appUrl: string;
  musicianName: string;
  musicianEmail: string;
  setsSchedule: string;
  packages: Array<{ id: string; order: number }>;
  playedPackageIds: string[];
  sets: CalendarSet[];
  generatedAt?: Date;
}

function datePart(date: Date): string {
  return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, '0'), String(date.getUTCDate()).padStart(2, '0')].join('');
}

function dateTimeValue(date: Date, minutes: number): string {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, minutes));
  return `${datePart(value)}T${String(value.getUTCHours()).padStart(2, '0')}${String(value.getUTCMinutes()).padStart(2, '0')}00`;
}

function timeMinutes(value: string | null): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function escapedText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

// RFC 5545 measures the 75-octet limit in UTF-8 bytes, not JavaScript characters. Iterating code
// points also prevents folding between the bytes of a multi-byte character.
function foldLine(line: string): string[] {
  const physicalLines: string[] = [];
  let current = '';
  let octets = 0;

  for (const character of line) {
    const characterOctets = Buffer.byteLength(character, 'utf8');
    if (octets + characterOctets > 75) {
      physicalLines.push(current);
      current = ' ';
      octets = 1;
    }
    current += character;
    octets += characterOctets;
  }

  physicalLines.push(current);
  return physicalLines;
}

function eventTimes(input: BandInviteCalendarInput): { start: number; end: number } | null {
  const playedPackages = new Set(input.playedPackageIds);
  const packageLessBooking = input.packages.length === 0;
  const relevantSets = input.sets.filter((set) =>
    packageLessBooking ? set.packageId === null : set.packageId !== null && playedPackages.has(set.packageId),
  );
  const timedSets = relevantSets.flatMap((set) => {
    const start = timeMinutes(set.startTime);
    return start === null ? [] : [{ ...set, start }];
  });
  if (timedSets.length === 0) return null;

  const start = Math.min(...timedSets.map((set) => set.start));
  // Packages are a grouping convenience, not a chronological boundary (their sets can interleave
  // in the running order). End at the latest finish among the segments this member actually plays.
  let end = Math.max(...timedSets.map((set) => set.start + Math.max(set.duration, 0)));
  while (end <= start) end += 24 * 60;

  return { start, end };
}

/** Build one dep's method-less, floating-time iCalendar snapshot (RFC 5545). */
export function buildBandInviteCalendar(input: BandInviteCalendarInput): string {
  const host = new URL(input.appUrl).host;
  const generatedAt = input.generatedAt ?? new Date();
  const venue = [input.venueName, input.venueAddress].filter(Boolean).join(', ');
  const organizerContact = input.musicianEmail
    ? `Contact: ${input.musicianName} (${input.musicianEmail})`
    : `Contact: ${input.musicianName}`;
  const description = [
    `Band portal: ${input.portalUrl}`,
    organizerContact,
    ...(input.setsSchedule ? [`Performance schedule:\n${input.setsSchedule}`] : []),
  ].join('\n');
  const times = eventTimes(input);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GigLoop//Band invitation//EN',
  ];
  lines.push(
    'BEGIN:VEVENT',
    `UID:${input.bookingId}.${input.contactId}@${host}`,
    `DTSTAMP:${generatedAt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    `SUMMARY:${escapedText(input.title || 'GigLoop booking')}`,
  );

  if (times) {
    lines.push(`DTSTART:${dateTimeValue(input.bookingDate, times.start)}`);
    lines.push(`DTEND:${dateTimeValue(input.bookingDate, times.end)}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${datePart(input.bookingDate)}`);
    lines.push(`DTEND;VALUE=DATE:${datePart(new Date(Date.UTC(input.bookingDate.getUTCFullYear(), input.bookingDate.getUTCMonth(), input.bookingDate.getUTCDate() + 1)))}`);
  }

  if (venue) lines.push(`LOCATION:${escapedText(venue)}`);
  lines.push(`URL:${input.portalUrl}`, `DESCRIPTION:${escapedText(description)}`, 'END:VEVENT', 'END:VCALENDAR');

  return `${lines.flatMap(foldLine).join('\r\n')}\r\n`;
}
