import {
  Music, Mic2, Guitar, Piano, Drum, Church, Cake, Wine, Star, Heart,
  GlassWater, Utensils, Moon, Briefcase, Music2, Sparkles, Radio, Headphones,
  Volume2, Users, Clock, Shirt, Sofa, type LucideIcon,
} from 'lucide-react';
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

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  ENQUIRY:     'Enquiry',
  PROVISIONAL: 'Provisional',
  CONFIRMED:   'Confirmed',
  READY:       'Ready',
  COMPLETE:    'Complete',
  CANCELLED:   'Cancelled',
};

export const PACKAGE_CATEGORY_LABELS: Record<string, string> = {
  WEDDING:   'Wedding',
  CORPORATE: 'Corporate',
  PRIVATE:   'Private',
  RESIDENCY: 'Residency',
  FESTIVAL:  'Festival',
  OUTDOOR:   'Outdoor',
  FUNCTION:  'Function',
  OTHER:     'Other',
};

export const PACKAGE_CATEGORY_ORDER = [
  'WEDDING', 'CORPORATE', 'PRIVATE', 'RESIDENCY', 'FESTIVAL', 'OUTDOOR', 'FUNCTION', 'OTHER',
] as const;

export const LOGISTICS_FIELD_LABELS: Record<string, string> = {
  arrivalTime:    'Arrival time',
  soundCheckTime: 'Soundcheck time',
  finishTime:     'Finish time',
  dressCode:      'Dress code',
  performanceSpace: 'Performance space',
  foodProvided:   'Food provided',
  greenRoom:      'Green room',
  equipmentRequired: 'Equipment required',
};

export const PACKAGE_ICON_MAP: Record<string, LucideIcon> = {
  clock: Clock,
  music: Music,
  'mic-2': Mic2,
  guitar: Guitar,
  piano: Piano,
  drum: Drum,
  church: Church,
  cake: Cake,
  wine: Wine,
  star: Star,
  heart: Heart,
  'glass-water': GlassWater,
  utensils: Utensils,
  moon: Moon,
  briefcase: Briefcase,
  'music-2': Music2,
  sparkles: Sparkles,
  radio: Radio,
  headphones: Headphones,
  'volume-2': Volume2,
  users: Users,
  shirt: Shirt,
  sofa: Sofa,
};

export const PACKAGE_ICON_OPTIONS = Object.keys(PACKAGE_ICON_MAP);

export const LOGISTICS_FIELD_ICONS: Record<string, string> = {
  arrivalTime:       'clock',
  soundCheckTime:    'music',
  finishTime:        'moon',
  dressCode:         'shirt',
  performanceSpace:  'mic-2',
  foodProvided:      'utensils',
  greenRoom:         'sofa',
  equipmentRequired: 'volume-2',
};

export const DRESS_CODE_OPTIONS = [
  'Smart Casual',
  'Formal',
  'Black Tie',
  'Morning Dress',
  'Casual',
  'Cocktail',
];
