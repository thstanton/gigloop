import type { TDocumentDefinitions, Content, ContentTable } from 'pdfmake/interfaces';
import { buildDocumentTitle, buildPdfHeader } from './pdf-shared';
import type {
  BandPortalRosterChair,
  BandPortalSegment,
  BandPortalVenueAddress,
} from '../portal/band-portal-fields';

// The band-portal call sheet (#893, ADR-0073 §4) — rendered from the same roster projection the
// band portal itself returns (`BandPortalRosterView`), so the two cannot drift. Deliberately built
// from that type's pieces rather than a second, hand-picked shape: `chairs` carries no
// `sessionFee` field at all (band-portal-fields.ts's `BandPortalRosterChair`), so there is no path
// for a fee to reach this document short of widening that type — structural, not a rule this
// module has to remember to follow.
export interface CallSheetBranding {
  businessName: string;
  musicianName: string;
  email?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  brandColour: string;
}

export interface CallSheetPdfData {
  branding: CallSheetBranding;
  bookingTitle: string | null;
  bookingDate: string;
  venueName: string | null;
  venueAddress: BandPortalVenueAddress | null;
  segments: BandPortalSegment[];
  chairs: BandPortalRosterChair[];
  /** Pre-formatted display timestamp — the self-dating footer text (ADR-0073 §4). */
  generatedAt: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatVenueAddress(address: BandPortalVenueAddress | null): string | null {
  if (!address) return null;
  return [address.line1, address.line2, address.city, address.county, address.postcode, address.country]
    .filter((part): part is string => !!part)
    .join(', ');
}

function buildBookingInfo(data: CallSheetPdfData): Content[] {
  const rows: Content[] = [
    { text: data.bookingTitle ?? 'Gig details', font: 'Commissioner', bold: true, fontSize: 13, margin: [0, 0, 0, 4] },
    { text: formatDate(data.bookingDate), font: 'Commissioner', fontSize: 10, color: '#374151', margin: [0, 0, 0, 2] },
  ];
  if (data.venueName) {
    const addressLine = formatVenueAddress(data.venueAddress);
    rows.push({
      text: addressLine ? `${data.venueName} — ${addressLine}` : data.venueName,
      font: 'Commissioner',
      fontSize: 10,
      color: '#374151',
      margin: [0, 0, 0, 2],
    });
  }
  return rows;
}

// One column per segment the day is split into, in day order, plus a leading Role/Name pair. A
// booking with no packages has no segments at all — every chair's call time (if any) is a
// package-less entry (`segmentId: null`), so that case gets a single "Call time" column instead
// (ADR-0081 §4's package-less bucket, same one `call-times.ts` groups into).
function buildCallTimeTable(segments: BandPortalSegment[], chairs: BandPortalRosterChair[]): Content {
  const ordered = [...segments].sort((a, b) => a.order - b.order);
  const columns = ordered.length > 0 ? ordered.map((s) => s.label) : ['Call time'];

  const headerRow: Content[] = [
    { text: 'Role', style: 'tableHeader' },
    { text: 'Name', style: 'tableHeader' },
    ...columns.map((label): Content => ({ text: label, style: 'tableHeader' })),
  ];

  const bodyRows: Content[][] = chairs.map((chair) => {
    const callTimeFor = (segmentId: string | null): string =>
      chair.callTimes.find((ct) => ct.segmentId === segmentId)?.startTime ?? '—';

    const timeCells: Content[] =
      ordered.length > 0
        ? ordered.map((segment): Content => ({ text: callTimeFor(segment.id), font: 'Commissioner', fontSize: 10 }))
        : [{ text: callTimeFor(null), font: 'Commissioner', fontSize: 10 }];

    return [
      { text: chair.role, font: 'Commissioner', fontSize: 10 },
      chair.memberName
        ? { text: chair.memberName, font: 'Commissioner', fontSize: 10 }
        : { text: 'Vacant', font: 'Commissioner', fontSize: 10, italics: true, color: '#9ca3af' },
      ...timeCells,
    ];
  });

  const table: ContentTable = {
    table: {
      headerRows: 1,
      widths: ['auto', '*', ...columns.map(() => 'auto')],
      body: [headerRow, ...bodyRows],
    },
    layout: {
      hLineWidth: (i: number, node: ContentTable) => (i === 0 || i === 1 || i === node.table.body.length ? 0.5 : 0.25),
      hLineColor: () => '#e5e5e5',
      vLineWidth: () => 0,
      paddingTop: () => 6,
      paddingBottom: () => 6,
    },
    margin: [0, 12, 0, 0],
  };
  return table;
}

function buildFooter(generatedAt: string): (currentPage: number, pageCount: number) => Content {
  return () => ({
    text: `Generated ${generatedAt} — check your portal`,
    alignment: 'center',
    fontSize: 8,
    color: '#999999',
    margin: [0, 0, 0, 0],
  });
}

export function buildCallSheetDefinition(data: CallSheetPdfData): TDocumentDefinitions {
  const content: Content[] = [
    ...buildPdfHeader(
      {
        logoUrl: data.branding.logoUrl,
        businessName: data.branding.businessName,
        email: data.branding.email ?? undefined,
        phone: data.branding.phone ?? undefined,
      },
      data.branding.brandColour,
    ),
    buildDocumentTitle('Call Sheet'),
    ...buildBookingInfo(data),
    buildCallTimeTable(data.segments, data.chairs),
  ];

  return {
    pageSize: 'A4',
    pageMargins: [54, 48, 54, 60],
    defaultStyle: { font: 'Commissioner', fontSize: 10, color: '#1a1a1a', lineHeight: 1.4 },
    styles: {
      tableHeader: { font: 'Commissioner', fontSize: 8, bold: true, color: '#888888' },
    },
    content,
    footer: buildFooter(data.generatedAt),
  };
}
