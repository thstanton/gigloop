import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';
import { buildDocumentTitle, buildPdfHeader, buildPdfFooter } from './pdf-shared';

export interface SongListSong {
  id: string;
  title: string;
  artist: string | null;
  genre: string;
}

export interface SongListSpecialRequest {
  key: string;
  section: string;
  song?: SongListSong;
  freeText?: string;
}

export interface SongListPdfData {
  musicianName: string;
  customerName: string;
  bookingDate: string;
  venueName: string | null;
  specialRequests: SongListSpecialRequest[];
  selectedSongs: SongListSong[];
  notes: string | null;
  submittedAt: string;
  logoUrl?: string | null;
  businessName: string;
  email?: string | null;
  brandColour: string;
}

function sectionHeading(text: string): Content {
  return {
    text: text.toUpperCase(),
    font: 'Commissioner',
    fontSize: 8,
    bold: true,
    color: '#888888',
    characterSpacing: 0.8,
    margin: [0, 10, 0, 4],
  };
}

function divider(): Content {
  return {
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 487, y2: 0, lineWidth: 0.5, lineColor: '#e5e5e5' }],
    margin: [0, 8, 0, 8],
  };
}

function songRow(song: SongListSong): Content {
  return {
    columns: [
      { text: song.title, font: 'Commissioner', fontSize: 10, width: '*' },
      { text: song.artist ?? '', font: 'Commissioner', fontSize: 10, color: '#666666', width: 180, alignment: 'right' },
    ],
    margin: [0, 0, 0, 4],
  };
}

function resolveSongText(req: SongListSpecialRequest): string {
  if (!req.song) return req.freeText ?? '(no selection)';
  const artist = req.song.artist ? ` — ${req.song.artist}` : '';
  return `${req.song.title}${artist}`;
}

function buildBookingInfo(data: SongListPdfData): Content[] {
  return [
    { columns: [{ text: 'Customer', font: 'Commissioner', width: 100, fontSize: 9, color: '#666666' }, { text: data.customerName, font: 'Commissioner', fontSize: 10, width: '*' }], margin: [0, 0, 0, 4] },
    { columns: [{ text: 'Date', font: 'Commissioner', width: 100, fontSize: 9, color: '#666666' }, { text: data.bookingDate, font: 'Commissioner', fontSize: 10, width: '*' }], margin: [0, 0, 0, 4] },
    ...(data.venueName ? [{ columns: [{ text: 'Venue', font: 'Commissioner', width: 100, fontSize: 9, color: '#666666' }, { text: data.venueName, font: 'Commissioner', fontSize: 10, width: '*' }], margin: [0, 0, 0, 4] } as Content] : []),
    { columns: [{ text: 'Submitted', font: 'Commissioner', width: 100, fontSize: 9, color: '#666666' }, { text: data.submittedAt, font: 'Commissioner', fontSize: 10, width: '*' }], margin: [0, 0, 0, 20] },
  ];
}

function buildSectionRows(section: string, reqs: SongListSpecialRequest[]): Content[] {
  return [
    sectionHeading(section),
    ...reqs.map((req): Content => ({
      columns: [
        { text: req.key, fontSize: 10, width: 160 },
        { text: resolveSongText(req), fontSize: 10, color: req.freeText && !req.song ? '#666666' : '#1a1a1a', width: '*' },
      ],
      margin: [0, 0, 0, 4],
    })),
  ];
}

function buildKeyMomentsSection(specialRequests: SongListSpecialRequest[]): Content[] {
  if (specialRequests.length === 0) return [];

  const sectionMap = new Map<string, SongListSpecialRequest[]>();
  for (const req of specialRequests) {
    if (!sectionMap.has(req.section)) sectionMap.set(req.section, []);
    sectionMap.get(req.section)!.push(req);
  }

  return [
    divider(),
    { text: 'Key moments', font: 'Commissioner', fontSize: 12, bold: true, margin: [0, 0, 0, 8] },
    ...[...sectionMap.entries()].flatMap(([section, reqs]) => buildSectionRows(section, reqs)),
  ];
}

function buildGeneralRequestsSection(selectedSongs: SongListSong[]): Content[] {
  if (selectedSongs.length === 0) return [];

  const genreMap = new Map<string, SongListSong[]>();
  for (const song of selectedSongs) {
    if (!genreMap.has(song.genre)) genreMap.set(song.genre, []);
    genreMap.get(song.genre)!.push(song);
  }

  const rows: Content[] = [divider(), { text: 'General requests', font: 'Commissioner', fontSize: 12, bold: true, margin: [0, 0, 0, 8] }];
  for (const [genre, songs] of genreMap.entries()) {
    rows.push(sectionHeading(genre));
    for (const song of songs) rows.push(songRow(song));
  }
  return rows;
}

function buildNotesSection(notes: string | null): Content[] {
  if (!notes) return [];
  return [
    divider(),
    { text: 'Notes', font: 'Commissioner', fontSize: 12, bold: true, margin: [0, 0, 0, 8] },
    { text: notes, font: 'Commissioner', fontSize: 10, color: '#374151' },
  ];
}

export function buildSongListDefinition(data: SongListPdfData): TDocumentDefinitions {
  const content: Content[] = [
    ...buildPdfHeader(
      {
        logoUrl: data.logoUrl,
        businessName: data.businessName,
        email: data.email ?? undefined,
      },
      data.brandColour,
    ),
    buildDocumentTitle('Music Requests'),
    ...buildBookingInfo(data),
    ...buildKeyMomentsSection(data.specialRequests),
    ...buildGeneralRequestsSection(data.selectedSongs),
    ...buildNotesSection(data.notes),
  ];

  return {
    pageSize: 'A4',
    pageMargins: [54, 48, 54, 60],
    defaultStyle: { font: 'Commissioner', fontSize: 10, color: '#1a1a1a', lineHeight: 1.4 },
    content,
    footer: buildPdfFooter(),
  };
}
