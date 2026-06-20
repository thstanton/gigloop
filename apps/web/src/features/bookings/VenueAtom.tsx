import { useState } from 'react';
import { MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/common/FormField';
import { SubLabel } from '@/components/common/SubLabel';
import ContactPicker from './ContactPicker';
import { VenuePlaceSearch, type VenuePlaceValue } from '@/components/common/VenuePlaceSearch';

// PRD #511 Module B — the Venue section editor atom (assignment only): pick an existing
// VENUE contact or inline-create a new one. It is Sheet-agnostic (one atom, three shells —
// reused later in the Builder) and never owns a mutation: it surfaces the user's intent via
// `onSave(selection)` and renders its Tier-1 save state from props. The host injects the
// regime (here: self-saving quick-tweak — the host's onSave runs the PATCH).

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

/** What the atom asks its host to persist. The host turns this into the actual PATCH
 *  (and, for `new`, a preceding contact create). */
export type VenueSelection =
  | { kind: 'existing'; venueId: string | null }
  | { kind: 'new'; venue: NewVenueData };

interface VenueAtomProps {
  /** The venue currently saved on the booking (null when unset). */
  initialVenueId: string | null;
  onSave: (selection: VenueSelection) => void;
  // Tier-1 save state, injected by the host.
  isSaving: boolean;
  saved: boolean;
  saveError: string | null;
}

function trimmedOrUndefined(value: string): string | undefined {
  return value.trim() || undefined;
}

export function VenueAtom({ initialVenueId, onSave, isSaving, saved, saveError }: VenueAtomProps) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [selectedId, setSelectedId] = useState<string | null>(initialVenueId);
  const [venueValue, setVenueValue] = useState<VenuePlaceValue>(EMPTY_VENUE);
  const [showMore, setShowMore] = useState(false);
  const [parking, setParking] = useState('');
  const [access, setAccess] = useState('');
  const [equipment, setEquipment] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  const existingDirty = (selectedId || null) !== (initialVenueId ?? null);
  const newHasName = !!venueValue.name.trim();
  const canSave = mode === 'existing' ? existingDirty : newHasName;

  const setAddressField =
    (field: keyof VenuePlaceValue) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setVenueValue((v) => ({ ...v, [field]: e.target.value, placeId: null, latitude: null, longitude: null }));

  function handleVenueChange(next: VenuePlaceValue) {
    setVenueValue(next);
    // A plain-address selection (a private house, a field) fills the address but no business
    // name, leaving the search box blank. Auto-open details so the captured address is visible
    // and the musician can name the venue.
    const hasAddress = !!(next.addressLine1 || next.city || next.postcode);
    if (hasAddress && !next.name.trim()) setShowMore(true);
  }

  function handleSave() {
    if (mode === 'existing') {
      onSave({ kind: 'existing', venueId: selectedId });
      return;
    }
    if (!venueValue.name.trim()) {
      setNameError('Venue name is required');
      return;
    }
    setNameError(null);
    onSave({
      kind: 'new',
      venue: {
        name: venueValue.name.trim(),
        addressLine1: trimmedOrUndefined(venueValue.addressLine1),
        addressLine2: trimmedOrUndefined(venueValue.addressLine2),
        city: trimmedOrUndefined(venueValue.city),
        county: trimmedOrUndefined(venueValue.county),
        postcode: trimmedOrUndefined(venueValue.postcode),
        country: trimmedOrUndefined(venueValue.country),
        latitude: venueValue.latitude,
        longitude: venueValue.longitude,
        placeId: venueValue.placeId,
        parkingInfo: trimmedOrUndefined(parking),
        accessInfo: trimmedOrUndefined(access),
        equipmentAvailable: trimmedOrUndefined(equipment),
      },
    });
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
    <div className="space-y-3">
      <Tabs value={mode} onValueChange={(v) => setMode(v as 'existing' | 'new')}>
        <div className="flex items-center justify-between gap-3">
          {header}
          <TabsList className="h-auto p-0.5 bg-secondary border border-border">
            <TabsTrigger
              value="existing"
              className="text-foreground/60 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
            >
              Select existing
            </TabsTrigger>
            <TabsTrigger
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
            onChange={setSelectedId}
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
                  onChange={(e) => setParking(e.target.value)}
                  rows={2}
                  placeholder="e.g. Free car park at rear"
                />
              </FormField>
              <FormField label="Access">
                <Textarea
                  value={access}
                  onChange={(e) => setAccess(e.target.value)}
                  rows={2}
                  placeholder="e.g. Stage door on left side"
                />
              </FormField>
              <FormField label="Equipment available">
                <Textarea
                  value={equipment}
                  onChange={(e) => setEquipment(e.target.value)}
                  rows={2}
                  placeholder="e.g. PA system, microphone stands"
                />
              </FormField>
            </div>
          )}

          {nameError && <p className="text-sm text-status-cancelled">{nameError}</p>}
        </TabsContent>
      </Tabs>

      {/* Tier-1 inline save (CLAUDE.md Loading & Feedback): disabled + "Saving…" while pending,
          inline "Saved" on success, inline error below the action. */}
      <div className="flex items-center gap-3 pt-1">
        <Button type="button" onClick={handleSave} disabled={isSaving || !canSave}>
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
        {saved && !isSaving && <span className="text-xs text-muted">Saved</span>}
        {saveError && <p className="text-sm text-status-cancelled">{saveError}</p>}
      </div>
    </div>
  );
}
