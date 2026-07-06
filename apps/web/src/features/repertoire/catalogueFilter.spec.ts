import { describe, it, expect } from 'vitest';
import { filterCatalogue } from './catalogueFilter';
import type { CatalogueEntry } from '@/types/api';

const CATALOGUE: CatalogueEntry[] = [
  { id: '1', title: 'Perfect', artist: 'Ed Sheeran', genre: 'CONTEMPORARY' },
  { id: '2', title: 'Thinking Out Loud', artist: 'Ed Sheeran', genre: 'CONTEMPORARY' },
  { id: '3', title: 'Fly Me to the Moon', artist: 'Frank Sinatra', genre: 'JAZZ' },
  { id: '4', title: 'Perfect Day', genre: 'CONTEMPORARY' }, // no artist
];

describe('filterCatalogue', () => {
  it('returns nothing for an empty or whitespace query', () => {
    expect(filterCatalogue(CATALOGUE, '')).toEqual([]);
    expect(filterCatalogue(CATALOGUE, '   ')).toEqual([]);
  });

  it('matches on title, case-insensitively', () => {
    expect(filterCatalogue(CATALOGUE, 'perFEct').map((e) => e.id)).toEqual(['1', '4']);
  });

  it('matches on artist', () => {
    expect(filterCatalogue(CATALOGUE, 'sheeran').map((e) => e.id)).toEqual(['1', '2']);
  });

  it('tolerates entries with no artist', () => {
    expect(filterCatalogue(CATALOGUE, 'day').map((e) => e.id)).toEqual(['4']);
  });

  it('caps results at the limit', () => {
    const many: CatalogueEntry[] = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      title: `Song ${i}`,
      genre: 'CONTEMPORARY',
    }));
    expect(filterCatalogue(many, 'song', 3)).toHaveLength(3);
  });
});
