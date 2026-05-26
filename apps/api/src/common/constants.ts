export const EVENT_TYPES = [
  'WEDDING',
  'CORPORATE',
  'PRIVATE',
  'RESIDENCY',
  'FESTIVAL',
  'OUTDOOR',
  'FUNCTION',
  'OTHER',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const SONG_GENRES = [
  'CONTEMPORARY',
  'CLASSICAL',
  'JAZZ',
  'FILM_TV_MUSICALS',
  'BOLLYWOOD',
  'CHRISTMAS',
] as const;

export type SongGenre = (typeof SONG_GENRES)[number];
