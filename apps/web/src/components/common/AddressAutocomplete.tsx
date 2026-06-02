import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
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

function loadMapsScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).google?.maps?.places?.PlaceAutocompleteElement) {
      resolve();
      return;
    }
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded) { resolve(); return; }
      existing.addEventListener('load', () => { existing.dataset.loaded = '1'; resolve(); });
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => { script.dataset.loaded = '1'; resolve(); };
    script.onerror = reject;
    document.head.appendChild(script);
  });
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
  const [loadFailed, setLoadFailed] = useState(false);
  const [manual, setManual] = useState(false);
  const hasSelection = !!value.placeId;

  useEffect(() => {
    if (manual || loadFailed) return;

    loadMapsScript()
      .then(() => {
        if (!containerRef.current) return;
        containerRef.current.innerHTML = '';

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const el = new (window as any).google.maps.places.PlaceAutocompleteElement({
          componentRestrictions: { country: ['gb'] },
        });

        containerRef.current.appendChild(el);

        el.addEventListener('gmp-placeselect', async (event: Event & { placePrediction: { toPlace(): unknown } }) => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const place = (event as any).placePrediction.toPlace();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (place as any).fetchFields({ fields: ['addressComponents', 'location', 'id'] });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const parsed = parseAddressComponents((place as any).addressComponents ?? []);
            onChange({
              ...parsed,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              latitude: (place as any).location?.lat() ?? null,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              longitude: (place as any).location?.lng() ?? null,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              placeId: (place as any).id ?? null,
            });
          } catch {
            // place fetch failed — don't crash
          }
        });
      })
      .catch(() => setLoadFailed(true));
  }, [manual, loadFailed, onChange]);

  if (loadFailed) {
    return <ManualEntry value={value} onChange={onChange} />;
  }

  if (manual) {
    return <ManualEntry value={value} onChange={onChange} onBack={() => setManual(false)} />;
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <MapPin size={16} className="absolute left-3 top-3 text-muted-foreground pointer-events-none z-10" />
        <div ref={containerRef} className="[&_gmp-placeautocomplete]:block [&_gmp-placeautocomplete]:w-full" />
      </div>
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
