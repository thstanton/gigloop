import type { CatalogueEntry } from '@/types/api';

/**
 * Filter the seed catalogue for the add-song autocomplete (#667): a case-insensitive substring
 * match over BOTH title and artist, capped so the dropdown stays short. Pure so it can be
 * unit-tested independently of the component.
 */
export function filterCatalogue(entries: CatalogueEntry[], query: string, limit = 6): CatalogueEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return entries
    .filter((e) => e.title.toLowerCase().includes(q) || (e.artist ?? '').toLowerCase().includes(q))
    .slice(0, limit);
}
