import { useEffect, useRef, useState } from 'react';
import { LabelValue } from '@/components/common/LabelValue';
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

// With loading=async, script.onload fires before google.maps is initialised.
// The correct pattern is: load bootstrap with callback=, then importLibrary('places').
let placesPromise: Promise<void> | null = null;

function loadPlaces(): Promise<void> {
  if (placesPromise) return placesPromise;
  placesPromise = new Promise<void>((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;

    const importPlaces = () =>
      win.google.maps.importLibrary('places').then(resolve).catch(reject);

    if (win.google?.maps?.importLibrary) {
      importPlaces();
      return;
    }

    if (document.getElementById(SCRIPT_ID)) {
      // Script already injected by another instance — wait for callback
      const prev = win[CALLBACK];
      win[CALLBACK] = () => { prev?.(); importPlaces(); };
      return;
    }

    win[CALLBACK] = importPlaces;
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    // Do NOT include libraries= here; importLibrary handles dynamic loading.
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
  // New Places API (v2) uses longText/shortText instead of long_name/short_name
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

// ─── Main component ───────────────────────────────────────────────────────────

export function AddressAutocomplete({ value, onChange }: AddressAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Keep latest onChange in a ref so the effect closure is never stale,
  // without including onChange in the deps (which would destroy/recreate the
  // element on every setValue call triggered by a selection).
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  const [loadFailed, setLoadFailed] = useState(false);
  const [manual, setManual] = useState(false);
  const hasSelection = !!value.placeId;

  useEffect(() => {
    if (manual || loadFailed) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let el: any = null;
    let active = true;

    loadPlaces()
      .then(() => {
        // Cleanup may have run before loadPlaces resolved (React Strict Mode runs
        // effects twice in dev; cleanup fires synchronously while el is still null).
        if (!active || !containerRef.current) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        el = new (window as any).google.maps.places.PlaceAutocompleteElement({
          componentRestrictions: { country: ['gb'] },
        });

        containerRef.current.appendChild(el);

        // PlaceAutocompleteElement fires gmp-placeselect with event.place (Place),
        // not event.placePrediction — that belongs to the Autocomplete Suggestions API.
        el.addEventListener('gmp-placeselect', async (event: Event) => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const place = (event as any).place;
            if (!place) { console.error('[AddressAutocomplete] gmp-placeselect: event.place missing', event); return; }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (place as any).fetchFields({ fields: ['addressComponents', 'location'] });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const parsed = parseAddressComponents((place as any).addressComponents ?? []);
            onChangeRef.current({
              ...parsed,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              latitude: (place as any).location?.lat() ?? null,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              longitude: (place as any).location?.lng() ?? null,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              placeId: (place as any).id ?? null,
            });
          } catch (err) {
            console.error('[AddressAutocomplete] failed to fetch place details', err);
          }
        });
      })
      .catch(() => { if (active) setLoadFailed(true); });

    return () => {
      active = false;
      if (el && containerRef.current?.contains(el)) {
        containerRef.current.removeChild(el);
      }
    };
  }, [manual, loadFailed]); // onChange intentionally excluded — onChangeRef stays current

  if (loadFailed) {
    return <ManualEntry value={value} onChange={onChange} />;
  }

  if (manual) {
    return <ManualEntry value={value} onChange={onChange} onBack={() => setManual(false)} />;
  }

  return (
    <div className="space-y-3">
      <div ref={containerRef} className="[&_gmp-placeautocomplete]:block [&_gmp-placeautocomplete]:w-full" />
      {hasSelection && (
        <div className="rounded-md border border-border px-3 py-1">
          {value.addressLine1 && <LabelValue label="Address">{value.addressLine1}</LabelValue>}
          {value.city && <LabelValue label="City">{value.city}</LabelValue>}
          {value.postcode && <LabelValue label="Postcode">{value.postcode}</LabelValue>}
        </div>
      )}
      <button type="button" onClick={() => setManual(true)} className="text-sm text-muted hover:text-foreground underline-offset-2 hover:underline">
        Enter manually
      </button>
    </div>
  );
}
