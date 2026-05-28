import type { BookingStatus, EventType, SongGenre } from '@/types/api';

export const GENRE_LABELS: Record<SongGenre, string> = {
  CONTEMPORARY:    'Contemporary',
  CLASSICAL:       'Classical',
  JAZZ:            'Jazz',
  FILM_TV_MUSICALS:'Film, TV & Musicals',
  BOLLYWOOD:       'Bollywood',
  CHRISTMAS:       'Christmas',
};

export const ALL_GENRES = Object.keys(GENRE_LABELS) as SongGenre[];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  WEDDING:   'Wedding',
  CORPORATE: 'Corporate',
  PRIVATE:   'Private event',
  RESIDENCY: 'Residency',
  FESTIVAL:  'Festival',
  OUTDOOR:   'Outdoor event',
  FUNCTION:  'Function',
  OTHER:     'Other',
};

export const STATUS_ORDER: BookingStatus[] = [
  'ENQUIRY',
  'PROVISIONAL',
  'CONFIRMED',
  'READY',
  'COMPLETE',
  'CANCELLED',
];

export const CHECKLIST_STAGE_ORDER: Array<BookingStatus | null> = [
  null,
  'ENQUIRY',
  'PROVISIONAL',
  'CONFIRMED',
  'READY',
  'COMPLETE',
];

export function statusGte(current: BookingStatus, threshold: BookingStatus): boolean {
  return STATUS_ORDER.indexOf(current) >= STATUS_ORDER.indexOf(threshold);
}
