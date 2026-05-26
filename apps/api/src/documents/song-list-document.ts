import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';

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
}

function grey(text: string): Content {
  return { text, color: '#666666', fontSize: 9 };
}

function sectionHeading(text: string): Content {
  return {
    text: text.toUpperCase(),
    fontSize: 8,
    bold: true,
    color: '#999999',
    letterSpacing: 0.5,
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
      { text: song.title, fontSize: 10, width: '*' },
      { text: song.artist ?? '', fontSize: 10, color: '#666666', width: 180, alignment: 'right' },
    ],
    margin: [0, 0, 0, 4],
  };
}

export function buildSongListDefinition(data: SongListPdfData): TDocumentDefinitions {
  const content: Content[] = [
    // Header
    { text: data.musicianName, style: 'header', margin: [0, 0, 0, 4] },
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 487, y2: 0, lineWidth: 0.5, lineColor: '#e5e5e5' }], margin: [0, 0, 0, 12] },

    // Booking summary
    {
      columns: [
        { text: 'Customer', width: 100, ...grey('Customer') },
        { text: data.customerName, fontSize: 10, width: '*' },
      ],
      margin: [0, 0, 0, 4],
    },
    {
      columns: [
        grey('Date'),
        { text: data.bookingDate, fontSize: 10, width: '*' },
      ],
      margin: [0, 0, 0, 4],
    },
    ...(data.venueName
      ? [{
          columns: [
            grey('Venue'),
            { text: data.venueName, fontSize: 10, width: '*' },
          ],
          margin: [0, 0, 0, 4],
        } as Content]
      : []),
    {
      columns: [
        grey('Submitted'),
        { text: data.submittedAt, fontSize: 10, width: '*' },
      ],
      margin: [0, 0, 0, 4],
    },
  ];

  // Key moments
  if (data.specialRequests.length > 0) {
    content.push(divider());
    content.push({ text: 'Key moments', fontSize: 12, bold: true, margin: [0, 0, 0, 8] });

    const sectionMap = new Map<string, SongListSpecialRequest[]>();
    for (const req of data.specialRequests) {
      if (!sectionMap.has(req.section)) sectionMap.set(req.section, []);
      sectionMap.get(req.section)!.push(req);
    }

    for (const [section, reqs] of sectionMap.entries()) {
      content.push(sectionHeading(section));
      for (const req of reqs) {
        const songText = req.song
          ? `${req.song.title}${req.song.artist ? ` — ${req.song.artist}` : ''}`
          : req.freeText ?? '(no selection)';
        content.push({
          columns: [
            { text: req.key, fontSize: 10, width: 160 },
            { text: songText, fontSize: 10, color: req.freeText && !req.song ? '#666666' : '#1a1a1a', width: '*' },
          ],
          margin: [0, 0, 0, 4],
        });
      }
    }
  }

  // General song requests
  if (data.selectedSongs.length > 0) {
    content.push(divider());
    content.push({ text: 'General requests', fontSize: 12, bold: true, margin: [0, 0, 0, 8] });

    const genreMap = new Map<string, SongListSong[]>();
    for (const song of data.selectedSongs) {
      if (!genreMap.has(song.genre)) genreMap.set(song.genre, []);
      genreMap.get(song.genre)!.push(song);
    }

    for (const [genre, songs] of genreMap.entries()) {
      content.push(sectionHeading(genre));
      for (const song of songs) {
        content.push(songRow(song));
      }
    }
  }

  // Notes
  if (data.notes) {
    content.push(divider());
    content.push({ text: 'Notes', fontSize: 12, bold: true, margin: [0, 0, 0, 8] });
    content.push({ text: data.notes, fontSize: 10, color: '#374151' });
  }

  return {
    pageSize: 'A4',
    pageMargins: [54, 48, 54, 60],
    defaultStyle: { font: 'Roboto', fontSize: 10, color: '#1a1a1a', lineHeight: 1.4 },
    content,
    styles: {
      header: { fontSize: 14, bold: true },
    },
  };
}
