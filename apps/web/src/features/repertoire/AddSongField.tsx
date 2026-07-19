import { useState, type Dispatch, type SetStateAction } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FormField } from '@/components/common/FormField';
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
 * Keyboard navigation for the catalogue combobox. Lifted to module scope (out of the component
 * body) so its branch cluster doesn't dominate AddSongField's complexity. `suggestions` is `[]`
 * whenever the dropdown is closed, so a non-empty list already implies "open" — no separate guard.
 */
function handleTypeaheadKey(
  e: React.KeyboardEvent<HTMLInputElement>,
  ctx: {
    suggestions: CatalogueEntry[];
    active: number;
    setActive: Dispatch<SetStateAction<number>>;
    setOpen: Dispatch<SetStateAction<boolean>>;
    addCatalogue: (entry: CatalogueEntry) => void;
  },
) {
  const { suggestions, active, setActive, setOpen, addCatalogue } = ctx;
  if (!suggestions.length) return;
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      setActive((i) => Math.min(i + 1, suggestions.length - 1));
      break;
    case 'ArrowUp':
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
      break;
    case 'Enter':
      e.preventDefault();
      addCatalogue(suggestions[Math.max(active, 0)]);
      break;
    case 'Escape':
      setOpen(false);
      setActive(-1);
      break;
  }
}

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
  catalogueLoading = false,
}: {
  catalogue: CatalogueEntry[];
  onAdd: (song: NewSong) => void;
  adding?: boolean;
  /**
   * True while the host's catalogue query is still pending. An unresolved catalogue and a
   * catalogue with genuinely no match are both `[]`, so without this the field would assert a
   * false "No matches" before the data has arrived (#701).
   */
  catalogueLoading?: boolean;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState<NewSong>(EMPTY);
  const suggestions = open ? filterCatalogue(catalogue, q) : [];

  // Panels below the input, mutually exclusive. A no-match is only asserted once the catalogue
  // has loaded; while it's still in flight we say "Searching…" instead. Both are suppressed once
  // manual entry is showing — the absolute panel would otherwise sit over the manual fields.
  const panelOpen = open && q.trim() !== '' && suggestions.length === 0 && !showManual;
  const searching = panelOpen && catalogueLoading;
  const noMatches = panelOpen && !catalogueLoading;

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

  const setField =
    <K extends keyof NewSong>(key: K) =>
    (value: NewSong[K]) =>
      setManual((m) => ({ ...m, [key]: value }));

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
          aria-expanded={suggestions.length > 0 || searching || noMatches}
          disabled={adding}
          className="pl-9"
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)}
          // Close when focus leaves the field entirely. Deterministic (vs. a deferred
          // setTimeout that could fire after unmount): suggestion buttons use
          // onPointerDown+preventDefault so selecting one never blurs the input.
          onBlur={(e) => { if (!e.currentTarget.parentElement?.contains(e.relatedTarget)) setOpen(false); }}
          onKeyDown={(e) => handleTypeaheadKey(e, { suggestions, active, setActive, setOpen, addCatalogue })}
        />
        {suggestions.length > 0 && (
          <ul role="listbox" className="absolute z-50 left-0 right-0 mt-1 bg-background border border-border rounded-md overflow-hidden shadow-md">
            {suggestions.map((e, i) => (
              <li key={e.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onPointerDown={(ev) => { ev.preventDefault(); addCatalogue(e); }}
                  onMouseEnter={() => setActive(i)}
                  className={cn('w-full text-left px-3 py-2 transition-colors hover:bg-accent', i === active && 'bg-accent')}
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
        {searching && (
          <p className="absolute z-50 left-0 right-0 mt-1 bg-background border border-border rounded-md px-3 py-2 text-sm text-muted shadow-md">
            Searching the catalogue…
          </p>
        )}
        {noMatches && (
          <div className="absolute z-50 left-0 right-0 mt-1 bg-background border border-border rounded-md px-3 py-2 shadow-md">
            <p className="text-sm text-foreground">No matches for “{q.trim()}”.</p>
            <button
              type="button"
              // onPointerDown + preventDefault (as the suggestion buttons do) so the input never
              // blurs — otherwise Safari, which doesn't focus buttons on click, would close the
              // panel before mouseup and the action would never fire.
              onPointerDown={(ev) => { ev.preventDefault(); setShowManual(true); }}
              className="mt-1 text-sm text-primary hover:underline"
            >
              Add it manually
            </button>
          </div>
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
            <FormField label="Title">
              <Input value={manual.title} placeholder="Song title" onChange={(e) => setField('title')(e.target.value)} />
            </FormField>
            <FormField label="Artist (optional)">
              <Input value={manual.artist} placeholder="Artist name" onChange={(e) => setField('artist')(e.target.value)} />
            </FormField>
          </div>
          <div className="space-y-1 sm:w-1/2">
            <Label>Genre</Label>
            <Select value={manual.genre} onValueChange={(v) => setField('genre')(v as SongGenre)}>
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
