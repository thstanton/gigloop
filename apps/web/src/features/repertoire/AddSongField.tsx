import { useState } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GENRE_LABELS, ALL_GENRES } from '@/lib/constants';
import type { CatalogueEntry, SongGenre } from '@/types/api';
import { filterCatalogue } from './catalogueFilter';

export interface NewSong {
  title: string;
  artist: string;
  genre: SongGenre;
}

const EMPTY: NewSong = { title: '', artist: '', genre: 'CONTEMPORARY' };

/**
 * The shared "add a song" control (#667). A full-width catalogue autocomplete is the primary path
 * (pick a suggestion → onAdd, with artist/genre filled from the catalogue); manual entry sits
 * behind a chevron disclosure — the same pattern as the add-venue / add-people fields. Presentational:
 * the catalogue is passed in and adds are emitted via onAdd; the host owns fetching + persistence
 * (Repertoire's add row, onboarding step 5). No heading/helper/list — those belong to the host.
 */
export function AddSongField({
  catalogue,
  onAdd,
  adding = false,
}: {
  catalogue: CatalogueEntry[];
  onAdd: (song: NewSong) => void;
  adding?: boolean;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState<NewSong>(EMPTY);
  const suggestions = open ? filterCatalogue(catalogue, q) : [];

  function addCatalogue(e: CatalogueEntry) {
    onAdd({ title: e.title, artist: e.artist ?? '', genre: e.genre as SongGenre });
    setQ('');
    setOpen(false);
    setActive(-1);
  }

  function addManual() {
    if (!manual.title.trim()) return;
    onAdd({ ...manual, title: manual.title.trim() });
    setManual(EMPTY);
  }

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || !suggestions.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); addCatalogue(suggestions[active >= 0 ? active : 0]); }
    else if (e.key === 'Escape') { setOpen(false); setActive(-1); }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        <Input
          value={q}
          placeholder="Search the catalogue by title or artist…"
          autoComplete="off"
          aria-label="Search the catalogue"
          role="combobox"
          aria-expanded={suggestions.length > 0}
          disabled={adding}
          className="pl-9"
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onSearchKey}
        />
        {suggestions.length > 0 && (
          <ul role="listbox" className="absolute z-50 left-0 right-0 mt-1 bg-background border border-border rounded-md overflow-hidden shadow-md">
            {suggestions.map((e, i) => (
              <li key={e.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onPointerDown={(ev) => { ev.preventDefault(); addCatalogue(e); }}
                  onMouseEnter={() => setActive(i)}
                  className={cn('w-full text-left px-3 py-2 transition-colors', i === active ? 'bg-accent' : 'hover:bg-accent')}
                >
                  <span className="block text-sm text-foreground truncate">{e.title}</span>
                  <span className="block text-xs text-muted truncate">
                    {[e.artist, GENRE_LABELS[e.genre as SongGenre] ?? e.genre].filter(Boolean).join(' · ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowManual((o) => !o)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {showManual ? (
          <><ChevronUp className="h-4 w-4" aria-hidden="true" />Hide manual entry</>
        ) : (
          <><ChevronDown className="h-4 w-4" aria-hidden="true" />Not in the catalogue? Enter it manually</>
        )}
      </button>

      {showManual && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input value={manual.title} placeholder="Song title" onChange={(e) => setManual((m) => ({ ...m, title: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Artist (optional)</Label>
              <Input value={manual.artist} placeholder="Artist name" onChange={(e) => setManual((m) => ({ ...m, artist: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1 sm:w-1/2">
            <Label>Genre</Label>
            <Select value={manual.genre} onValueChange={(v) => setManual((m) => ({ ...m, genre: v as SongGenre }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_GENRES.map((g) => (
                  <SelectItem key={g} value={g}>{GENRE_LABELS[g]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={addManual} disabled={adding || !manual.title.trim()}>
            {adding ? 'Adding…' : 'Add song'}
          </Button>
        </div>
      )}
    </div>
  );
}
