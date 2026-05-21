import type { BookingStatus, EventType } from '@/types/api';

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  WEDDING:   'Wedding',
  CORPORATE: 'Corporate',
  PRIVATE:   'Private event',
  RESIDENCY: 'Residency',
  OTHER:     'Other',
};

export const STATUS_ORDER: BookingStatus[] = [
  'ENQUIRY',
  'CONFIRMED',
  'INVOICED',
  'SETTLED',
  'COMPLETED',
  'CANCELLED',
];

export function statusGte(current: BookingStatus, threshold: BookingStatus): boolean {
  return STATUS_ORDER.indexOf(current) >= STATUS_ORDER.indexOf(threshold);
}
