import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { LabelValue } from '@/components/common/LabelValue';

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
    if (document.getElementById(SCRIPT_ID)) {
      if (window.google?.maps?.places) resolve();
      else {
        const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement;
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', reject);
      }
      return;
    }
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function parseAddressComponents(
  components: google.maps.GeocoderAddressComponent[],
): Pick<AddressFields, 'addressLine1' | 'addressLine2' | 'city' | 'county' | 'postcode' | 'country'> {
  const get = (type: string) =>
    components.find((c) => c.types.includes(type))?.long_name ?? '';
  const getShort = (type: string) =>
    components.find((c) => c.types.includes(type))?.short_name ?? '';

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

export function AddressAutocomplete({ value, onChange }: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const hasSelection = !!value.placeId;

  useEffect(() => {
    loadMapsScript().then(() => {
      if (!inputRef.current || autocompleteRef.current) return;
      autocompleteRef.current = new window.google.maps.places.Autocomplete(
        inputRef.current,
        { componentRestrictions: { country: 'gb' }, fields: ['address_components', 'geometry', 'place_id'] },
      );
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current!.getPlace();
        if (!place.address_components) return;
        const parsed = parseAddressComponents(place.address_components);
        onChange({
          ...parsed,
          latitude: place.geometry?.location?.lat() ?? null,
          longitude: place.geometry?.location?.lng() ?? null,
          placeId: place.place_id ?? null,
        });
        setSearchQuery('');
      });
    });
  }, [onChange]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for an address…"
          autoComplete="off"
          className="pl-9"
        />
      </div>
      {hasSelection && (
        <div className="rounded-md border border-border px-3 py-1">
          {value.addressLine1 && <LabelValue label="Address">{value.addressLine1}</LabelValue>}
          {value.city && <LabelValue label="City">{value.city}</LabelValue>}
          {value.postcode && <LabelValue label="Postcode">{value.postcode}</LabelValue>}
        </div>
      )}
    </div>
  );
}
