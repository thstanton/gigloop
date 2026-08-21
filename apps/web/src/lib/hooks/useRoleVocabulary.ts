import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { apiGet } from '@/lib/api';
import type { LineupTemplate } from '@/types/api';
import { useContacts } from './useContacts';

// Type-ahead vocabulary shared by chair roles and contact instruments (#886, ADR-0072 §3/§4):
// every role used in an existing lineup slot, plus every contact's declared instruments and
// primaryBandRole. Derived client-side from data the app already fetches elsewhere (`/contacts`,
// `/lineups`) — no dedicated vocabulary endpoint. Soft matching (not a hard filter) happens where
// this is consumed, via the browser's native <datalist> substring matching.
//
// `enabled` lets a caller that already runs its own gated `['lineups']` query (e.g. BandSheet,
// only while its sheet is open) suppress this hook's own fetch — the query key is shared, so an
// always-on second observer would otherwise force it to fire eagerly regardless of that gate.
export function useRoleVocabulary(enabled: boolean = true): string[] {
  const { isLoaded } = useAuth();
  const { data: contacts = [] } = useContacts();
  const { data: lineups = [] } = useQuery({
    queryKey: ['lineups'],
    queryFn: () => apiGet<LineupTemplate[]>('/lineups'),
    enabled: isLoaded && enabled,
  });

  const values = new Set<string>();
  for (const contact of contacts) {
    if (contact.primaryBandRole) values.add(contact.primaryBandRole);
    // Guarded: some story/test fixtures predate #886 and don't carry the new field.
    (contact.instruments ?? []).forEach((instrument) => values.add(instrument));
  }
  for (const lineup of lineups) {
    (lineup.slots ?? []).forEach((slot) => values.add(slot.role));
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}
