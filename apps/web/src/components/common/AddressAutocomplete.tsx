import { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/common/FormField';

export interface AddressFields {
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

export interface AddressAutocompleteProps {
  value: AddressFields;
  onChange: (v: AddressFields) => void;
}

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
const SCRIPT_ID = 'google-maps-script';
const CALLBACK = '__gmapsReady';

let placesPromise: Promise<void> | null = null;

function loadPlaces(): Promise<void> {
  if (placesPromise) return placesPromise;
  placesPromise = new Promise<void>((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    const importPlaces = () =>
      win.google.maps.importLibrary('places').then(resolve).catch(reject);
    if (win.google?.maps?.importLibrary) { importPlaces(); return; }
    if (document.getElementById(SCRIPT_ID)) {
      const prev = win[CALLBACK];
      win[CALLBACK] = () => { prev?.(); importPlaces(); };
      return;
    }
    win[CALLBACK] = importPlaces;
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&loading=async&callback=${CALLBACK}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => { placesPromise = null; reject(new Error('Maps failed')); };
    document.head.appendChild(script);
  });
  return placesPromise;
}

function parseAddressComponents(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  components: any[],
): Pick<AddressFields, 'addressLine1' | 'addressLine2' | 'city' | 'county' | 'postcode' | 'country'> {
  const get = (type: string): string =>
    components.find((c) => c.types?.includes(type))?.longText ?? '';
  const getShort = (type: string): string =>
    components.find((c) => c.types?.includes(type))?.shortText ?? '';

  const streetNumber = get('street_number');
  const route = get('route');
  const premise = get('premise');
  const subpremise = get('subpremise');

  const addressLine1 = streetNumber && route
    ? `${streetNumber} ${route}`
    : premise || route || get('establishment');
  const addressLine2 = subpremise || (premise && route ? premise : '');

  return {
    addressLine1,
    addressLine2,
    city: get('postal_town') || get('locality') || get('administrative_area_level_2'),
    county: get('administrative_area_level_2') || get('administrative_area_level_1'),
    postcode: getShort('postal_code'),
    country: getShort('country'),
  };
}

// ─── Manual entry fallback ────────────────────────────────────────────────────

function ManualEntry({
  value,
  onChange,
  onBack,
}: {
  value: AddressFields;
  onChange: (v: AddressFields) => void;
  onBack?: () => void;
}) {
  const set = (field: keyof AddressFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [field]: e.target.value, placeId: null, latitude: null, longitude: null });

  return (
    <div className="space-y-3">
      {onBack && (
        <button type="button" onClick={onBack} className="text-sm text-muted hover:text-foreground underline-offset-2 hover:underline">
          ← Search instead
        </button>
      )}
      <div className="space-y-2">
        <FormField label="Address line 1">
          <Input value={value.addressLine1} onChange={set('addressLine1')} placeholder="123 High Street" />
        </FormField>
        <FormField label="Address line 2">
          <Input value={value.addressLine2} onChange={set('addressLine2')} placeholder="(optional)" />
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <FormField label="City">
            <Input value={value.city} onChange={set('city')} />
          </FormField>
          <FormField label="Postcode">
            <Input value={value.postcode} onChange={set('postcode')} />
          </FormField>
        </div>
      </div>
    </div>
  );
}

// ─── Editable fields shown after a place is selected ─────────────────────────

// ─── Main component ───────────────────────────────────────────────────────────

export function AddressAutocomplete({ value, onChange }: AddressAutocompleteProps) {
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  const [query, setQuery] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loadFailed, setLoadFailed] = useState(false);
  const [manual, setManual] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessionTokenRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasSelection = !!value.placeId;

  // Pre-load Places on mount so the first keystroke isn't delayed.
  useEffect(() => {
    loadPlaces()
      .then(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win = window as any;
        sessionTokenRef.current = new win.google.maps.places.AutocompleteSessionToken();
      })
      .catch(() => setLoadFailed(true));
  }, []);

  // Close suggestions when clicking outside.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSuggestions([]);
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
      const { AutocompleteSuggestion } = await win.google.maps.importLibrary('places');
      const { suggestions: results } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input,
        includedRegionCodes: ['gb'],
        sessionToken: sessionTokenRef.current,
      });
      setSuggestions(results ?? []);
    } catch (err) {
      console.error('[AddressAutocomplete] suggestions fetch failed', err);
      setSuggestions([]);
    }
  }, []);

  useEffect(() => {
    if (loadFailed || manual) return;
    const t = setTimeout(() => fetchSuggestions(query), 300);
    return () => clearTimeout(t);
  }, [query, fetchSuggestions, loadFailed, manual]);

  // Reset activeIndex whenever suggestions list changes.
  useEffect(() => { setActiveIndex(-1); }, [suggestions]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectSuggestion = async (suggestion: any) => {
    setSuggestions([]);
    setQuery('');
    setActiveIndex(-1);
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({ fields: ['addressComponents', 'location'] });
      const parsed = parseAddressComponents(place.addressComponents ?? []);
      onChangeRef.current({
        ...parsed,
        latitude: place.location?.lat() ?? null,
        longitude: place.location?.lng() ?? null,
        placeId: place.id ?? null,
      });
      // Refresh token — the previous session is now closed by fetchFields.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any;
      sessionTokenRef.current = new win.google.maps.places.AutocompleteSessionToken();
    } catch (err) {
      console.error('[AddressAutocomplete] place detail fetch failed', err);
    }
  };

  if (loadFailed || manual) {
    return <ManualEntry value={value} onChange={onChange} onBack={loadFailed ? undefined : () => setManual(false)} />;
  }

  const hasData = !!(value.addressLine1 || value.city || value.postcode);
  const setField = (field: keyof AddressFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [field]: e.target.value, placeId: null, latitude: null, longitude: null });

  return (
    <div ref={containerRef} className="space-y-3">
      <div className="relative">
        <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
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
          placeholder="Search for an address…"
          autoComplete="off"
          className="pl-9"
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-activedescendant={activeIndex >= 0 ? `addr-suggestion-${activeIndex}` : undefined}
        />
        {suggestions.length > 0 && (
          <ul role="listbox" className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md overflow-hidden shadow-md">
            {suggestions.map((s, i) => (
              <li key={i} id={`addr-suggestion-${i}`} role="option" aria-selected={i === activeIndex}>
                <button
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${i === activeIndex ? 'bg-muted' : 'hover:bg-muted'}`}
                  onPointerDown={(e) => {
                    e.preventDefault(); // prevent input blur before selection
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

      {hasData && (
        <div className="space-y-2">
          <FormField label="Address line 1">
            <Input value={value.addressLine1} onChange={setField('addressLine1')} />
          </FormField>
          <FormField label="Address line 2">
            <Input value={value.addressLine2} onChange={setField('addressLine2')} placeholder="(optional)" />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <FormField label="City">
              <Input value={value.city} onChange={setField('city')} />
            </FormField>
            <FormField label="Postcode">
              <Input value={value.postcode} onChange={setField('postcode')} />
            </FormField>
          </div>
        </div>
      )}

      {!hasData && (
        <button type="button" onClick={() => setManual(true)} className="text-sm text-muted hover:text-foreground underline-offset-2 hover:underline">
          Enter manually
        </button>
      )}
    </div>
  );
}
