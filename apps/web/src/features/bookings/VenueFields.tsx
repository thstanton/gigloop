import { useState } from 'react';
import { MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/common/FormField';
import { SubLabel } from '@/components/common/SubLabel';
import ContactPicker from './ContactPicker';
import { VenuePlaceSearch, type VenuePlaceValue } from '@/components/common/VenuePlaceSearch';

// PRD #511 Module B / ADR-0053 — the controlled presentational core for *assigning* the Venue.
// Sibling to DetailsFields / MusicFields / PeopleFields: it owns its ephemeral form state
// (Google Places search + parking/access/equipment) and surfaces the user's intended selection
// via `onChange` — no booking id, no PATCH, no save row.
//
// ADR-0066: this core is *assign-mode only*, and deliberately so. Amending an already-assigned
// venue is not its job — VenueAtom swaps in AssignedContactCardContainer for that, which reuses
// the canonical validated ContactForm. Keeping this file untouched is what structurally excludes
// contact editing from the New Booking create path, which composes VenueFields directly
// (BookingFormFields) rather than going through VenueAtom. Do not add an edit mode here.
//
// Clearing the picker and saving is also how a venue is *removed* from a booking (ADR-0066
// retired ContactEditSheet, whose footer used to be the only "Remove venue from booking" route).

const EMPTY_VENUE: VenuePlaceValue = {
  name: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  county: '',
  postcode: '',
  country: 'GB',
  latitude: null,
  longitude: null,
  placeId: null,
};

/** Fields for an inline-created venue contact (role VENUE). */
export interface NewVenueData {
  name: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  county?: string;
  postcode?: string;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
  parkingInfo?: string;
  accessInfo?: string;
  equipmentAvailable?: string;
}

/** What the core asks its host to persist. The host turns this into the actual write
 *  (and, for `new`, a preceding contact create). */
export type VenueSelection =
  | { kind: 'existing'; venueId: string | null }
  | { kind: 'new'; venue: NewVenueData };

function trimmedOrUndefined(value: string): string | undefined {
  return value.trim() || undefined;
}

interface VenueFieldsProps {
  /** The venue currently attached (null when unset). */
  initialVenueId: string | null;
  onChange: (selection: VenueSelection) => void;
}

export function VenueFields({ initialVenueId, onChange }: VenueFieldsProps) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [selectedId, setSelectedId] = useState<string | null>(initialVenueId);
  const [venueValue, setVenueValue] = useState<VenuePlaceValue>(EMPTY_VENUE);
  const [showMore, setShowMore] = useState(false);
  const [parking, setParking] = useState('');
  const [access, setAccess] = useState('');
  const [equipment, setEquipment] = useState('');

  function report(
    over: Partial<{
      mode: 'existing' | 'new';
      selectedId: string | null;
      venue: VenuePlaceValue;
      parking: string;
      access: string;
      equipment: string;
    }> = {},
  ) {
    const m = over.mode ?? mode;
    const sid = over.selectedId !== undefined ? over.selectedId : selectedId;
    const v = over.venue ?? venueValue;
    const p = over.parking ?? parking;
    const a = over.access ?? access;
    const eq = over.equipment ?? equipment;
    if (m === 'existing') {
      onChange({ kind: 'existing', venueId: sid });
      return;
    }
    onChange({
      kind: 'new',
      venue: {
        name: v.name.trim(),
        addressLine1: trimmedOrUndefined(v.addressLine1),
        addressLine2: trimmedOrUndefined(v.addressLine2),
        city: trimmedOrUndefined(v.city),
        county: trimmedOrUndefined(v.county),
        postcode: trimmedOrUndefined(v.postcode),
        country: trimmedOrUndefined(v.country),
        latitude: v.latitude,
        longitude: v.longitude,
        placeId: v.placeId,
        parkingInfo: trimmedOrUndefined(p),
        accessInfo: trimmedOrUndefined(a),
        equipmentAvailable: trimmedOrUndefined(eq),
      },
    });
  }

  const setAddressField =
    (field: keyof VenuePlaceValue) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = { ...venueValue, [field]: e.target.value, placeId: null, latitude: null, longitude: null };
      setVenueValue(next);
      report({ venue: next });
    };

  function handleVenueChange(next: VenuePlaceValue) {
    setVenueValue(next);
    // A plain-address selection (a private house, a field) fills the address but no business
    // name, leaving the search box blank. Auto-open details so the captured address is visible
    // and the musician can name the venue.
    const hasAddress = !!(next.addressLine1 || next.city || next.postcode);
    if (hasAddress && !next.name.trim()) setShowMore(true);
    report({ venue: next });
  }

  function handleModeChange(value: string) {
    const next = value as 'existing' | 'new';
    setMode(next);
    report({ mode: next });
  }

  const header = (
    <div className="flex items-center gap-1.5">
      <MapPin size={16} className="text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-semibold">
        Venue <span className="font-normal text-muted-foreground">(optional)</span>
      </p>
    </div>
  );

  return (
    <Tabs value={mode} onValueChange={handleModeChange}>
      <div className="flex items-center justify-between gap-3">
        {header}
        <TabsList size="sm" className="bg-secondary border border-border">
          <TabsTrigger
            size="sm"
            value="existing"
            className="text-foreground/60 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
          >
            Select existing
          </TabsTrigger>
          <TabsTrigger
            size="sm"
            value="new"
            className="text-foreground/60 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
          >
            + New
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="existing" className="mt-3">
        <ContactPicker
          value={selectedId}
          onChange={(id) => { setSelectedId(id); report({ selectedId: id }); }}
          placeholder="Select venue..."
          label="venue"
          preferredRole="VENUE"
          disableCreate
        />
      </TabsContent>

      <TabsContent value="new" className="mt-3 space-y-3">
        {/* Wrapper intercepts Enter: VenuePlaceSearch handles it when suggestions are open;
            wrapper prevents outer submission when there are no suggestions. */}
        <div onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}>
          <VenuePlaceSearch value={venueValue} onChange={handleVenueChange} searchOnly />
        </div>

        <button
          type="button"
          onClick={() => setShowMore((o) => !o)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {showMore ? (
            <><ChevronUp className="h-4 w-4" aria-hidden="true" />Hide venue details</>
          ) : (
            <><ChevronDown className="h-4 w-4" aria-hidden="true" />Add more venue details</>
          )}
        </button>

        {showMore && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <SubLabel>Venue name</SubLabel>
              <Input
                value={venueValue.name}
                onChange={setAddressField('name')}
                placeholder="e.g. The O2 Arena"
              />
            </div>
            <div className="space-y-1.5">
              <SubLabel>Address line 1</SubLabel>
              <Input
                value={venueValue.addressLine1}
                onChange={setAddressField('addressLine1')}
                placeholder="123 High Street"
              />
            </div>
            <div className="space-y-1.5">
              <SubLabel>Address line 2</SubLabel>
              <Input
                value={venueValue.addressLine2}
                onChange={setAddressField('addressLine2')}
                placeholder="(optional)"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <SubLabel>City</SubLabel>
                <Input value={venueValue.city} onChange={setAddressField('city')} />
              </div>
              <div className="space-y-1.5">
                <SubLabel>Postcode</SubLabel>
                <Input value={venueValue.postcode} onChange={setAddressField('postcode')} />
              </div>
            </div>
            <FormField label="Parking">
              <Textarea
                value={parking}
                onChange={(e) => { setParking(e.target.value); report({ parking: e.target.value }); }}
                rows={2}
                placeholder="e.g. Free car park at rear"
              />
            </FormField>
            <FormField label="Access">
              <Textarea
                value={access}
                onChange={(e) => { setAccess(e.target.value); report({ access: e.target.value }); }}
                rows={2}
                placeholder="e.g. Stage door on left side"
              />
            </FormField>
            <FormField label="Equipment available">
              <Textarea
                value={equipment}
                onChange={(e) => { setEquipment(e.target.value); report({ equipment: e.target.value }); }}
                rows={2}
                placeholder="e.g. PA system, microphone stands"
              />
            </FormField>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
