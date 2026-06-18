import { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { SubLabel } from '@/components/common/SubLabel';
import { loadPlaces, parseAddressComponents } from '@/components/common/AddressAutocomplete';

export interface VenuePlaceValue {
  name: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  county: string;
  postcode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
}

export interface VenuePlaceSearchProps {
  value: VenuePlaceValue;
  onChange: (v: VenuePlaceValue) => void;
  /** Show only the search input; hides inline address fields and "Enter manually" link.
   *  When Places fails to load, renders a plain name input instead of ManualEntry. */
  searchOnly?: boolean;
}

// ─── Manual-entry fallback ────────────────────────────────────────────────────

function ManualEntry({
  value,
  onChange,
  onBack,
}: {
  value: VenuePlaceValue;
  onChange: (v: VenuePlaceValue) => void;
  onBack?: () => void;
}) {
  const setField =
    (field: keyof VenuePlaceValue) => (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...value, [field]: e.target.value, placeId: null, latitude: null, longitude: null });

  return (
    <div className="space-y-3">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted hover:text-foreground underline-offset-2 hover:underline"
        >
          ← Search instead
        </button>
      )}
      <div className="space-y-2">
        <div className="space-y-1.5">
          <SubLabel>Venue name</SubLabel>
          <Input
            value={value.name}
            onChange={setField('name')}
            placeholder="e.g. The O2 Arena"
          />
        </div>
        <div className="space-y-1.5">
          <SubLabel>Address line 1</SubLabel>
          <Input value={value.addressLine1} onChange={setField('addressLine1')} placeholder="123 High Street" />
        </div>
        <div className="space-y-1.5">
          <SubLabel>Address line 2</SubLabel>
          <Input value={value.addressLine2} onChange={setField('addressLine2')} placeholder="(optional)" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <SubLabel>City</SubLabel>
            <Input value={value.city} onChange={setField('city')} />
          </div>
          <div className="space-y-1.5">
            <SubLabel>Postcode</SubLabel>
            <Input value={value.postcode} onChange={setField('postcode')} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const ESTABLISHMENT_TYPES = new Set(['establishment', 'point_of_interest']);

export function VenuePlaceSearch({ value, onChange, searchOnly = false }: VenuePlaceSearchProps) {
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  const [loadFailed, setLoadFailed] = useState(false);
  const [manual, setManual] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Gate to prevent re-opening suggestions after a selection sets value.name
  const [isSearching, setIsSearching] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionTokenRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadPlaces().catch(() => setLoadFailed(true));
  }, []);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSuggestions([]);
        setIsSearching(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const fetchSuggestions = useCallback(async (input: string) => {
    if (!input.trim()) { setSuggestions([]); return; }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any;
      const { AutocompleteSuggestion, AutocompleteSessionToken } = await win.google.maps.importLibrary('places');
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new AutocompleteSessionToken();
      }
      const { suggestions: results } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input,
        includedRegionCodes: ['gb'],
        sessionToken: sessionTokenRef.current,
      });
      setSuggestions(results ?? []);
    } catch (err) {
      console.error('[VenuePlaceSearch] suggestions fetch failed', err);
      setSuggestions([]);
    }
  }, []);

  useEffect(() => {
    if (loadFailed || manual || !isSearching) return;
    const t = setTimeout(() => fetchSuggestions(value.name), 300);
    return () => clearTimeout(t);
  }, [value.name, fetchSuggestions, loadFailed, manual, isSearching]);

  useEffect(() => { setActiveIndex(-1); }, [suggestions]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectSuggestion = async (suggestion: any) => {
    setSuggestions([]);
    setIsSearching(false);
    setActiveIndex(-1);
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({ fields: ['addressComponents', 'location', 'displayName', 'types'] });

      const parsed = parseAddressComponents(place.addressComponents ?? []);

      // Read types from the resolved Place (fetched above), not the prediction —
      // prediction-level types don't reliably carry establishment/point_of_interest
      // at runtime, which left venue names blank after selection.
      const placeTypes: string[] = place.types ?? [];
      const isEstablishment = placeTypes.some((t) => ESTABLISHMENT_TYPES.has(t));
      const venueName = isEstablishment ? (place.displayName ?? '') : '';

      onChangeRef.current({
        name: venueName,
        ...parsed,
        latitude: place.location?.lat() ?? null,
        longitude: place.location?.lng() ?? null,
        placeId: place.id ?? null,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any;
      const { AutocompleteSessionToken } = await win.google.maps.importLibrary('places');
      sessionTokenRef.current = new AutocompleteSessionToken();
    } catch (err) {
      console.error('[VenuePlaceSearch] place detail fetch failed', err);
    }
  };

  if (loadFailed || manual) {
    if (searchOnly) {
      return (
        <div className="relative">
          <MapPin
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <Input
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder="e.g. The O2 Arena"
            className="pl-9"
          />
        </div>
      );
    }
    return (
      <ManualEntry
        value={value}
        onChange={onChange}
        onBack={loadFailed ? undefined : () => setManual(false)}
      />
    );
  }

  const hasAddress = !!(value.addressLine1 || value.city || value.postcode);
  const setAddressField =
    (field: keyof VenuePlaceValue) => (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...value, [field]: e.target.value, placeId: null, latitude: null, longitude: null });

  return (
    <div ref={containerRef} className="space-y-3">
      <div className="relative">
        <MapPin
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <Input
          value={value.name}
          onChange={(e) => {
            setIsSearching(true);
            onChange({ ...value, name: e.target.value });
          }}
          onKeyDown={(e) => {
            if (!suggestions.length) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (activeIndex >= 0) void selectSuggestion(suggestions[activeIndex]);
            } else if (e.key === 'Escape') {
              setSuggestions([]);
              setActiveIndex(-1);
            }
          }}
          placeholder="Search for a venue…"
          autoComplete="off"
          className="pl-9"
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-activedescendant={activeIndex >= 0 ? `venue-suggestion-${activeIndex}` : undefined}
        />
        {suggestions.length > 0 && (
          <ul
            role="listbox"
            className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md overflow-hidden shadow-md"
          >
            {suggestions.map((s, i) => (
              <li key={i} id={`venue-suggestion-${i}`} role="option" aria-selected={i === activeIndex}>
                <button
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${i === activeIndex ? 'bg-muted' : 'hover:bg-muted'}`}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    void selectSuggestion(s);
                  }}
                >
                  {s.placePrediction?.text?.toString() ?? ''}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!searchOnly && hasAddress && (
        <div className="space-y-2">
          <div className="space-y-1.5">
            <SubLabel>Address line 1</SubLabel>
            <Input value={value.addressLine1} onChange={setAddressField('addressLine1')} />
          </div>
          <div className="space-y-1.5">
            <SubLabel>Address line 2</SubLabel>
            <Input value={value.addressLine2} onChange={setAddressField('addressLine2')} placeholder="(optional)" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <SubLabel>City</SubLabel>
              <Input value={value.city} onChange={setAddressField('city')} />
            </div>
            <div className="space-y-1.5">
              <SubLabel>Postcode</SubLabel>
              <Input value={value.postcode} onChange={setAddressField('postcode')} />
            </div>
          </div>
        </div>
      )}

      {!searchOnly && !hasAddress && (
        <button
          type="button"
          onClick={() => setManual(true)}
          className="text-sm text-muted hover:text-foreground underline-offset-2 hover:underline"
        >
          Enter manually
        </button>
      )}
    </div>
  );
}
