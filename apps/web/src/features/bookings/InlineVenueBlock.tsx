import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/common/FormField';
import { SubLabel } from '@/components/common/SubLabel';
import ContactPicker from './ContactPicker';
import { VenuePlaceSearch, type VenuePlaceValue } from '@/components/common/VenuePlaceSearch';
import { apiPost } from '@/lib/api';
import type { Contact } from '@/types/api';

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

interface InlineVenueBlockProps {
  value: string | null;
  onChange: (id: string | null) => void;
  error?: string;
  /** When provided, the block is in edit mode: a per-box Save appears whenever the
   *  selection differs from committedValue (the venue saved on the booking). */
  committedValue?: string | null;
  onSave?: (value: string | null) => void;
  isSaving?: boolean;
  saveError?: string | null;
}

export function InlineVenueBlock({
  value,
  onChange,
  error,
  committedValue,
  onSave,
  isSaving,
  saveError,
}: InlineVenueBlockProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [venueValue, setVenueValue] = useState<VenuePlaceValue>(EMPTY_VENUE);
  const [showMore, setShowMore] = useState(false);
  const [parking, setParking] = useState('');
  const [access, setAccess] = useState('');
  const [equipment, setEquipment] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      apiPost<Contact>('/contacts', {
        name: venueValue.name.trim(),
        primaryRole: 'VENUE',
        addressLine1: venueValue.addressLine1 || undefined,
        addressLine2: venueValue.addressLine2 || undefined,
        city: venueValue.city || undefined,
        county: venueValue.county || undefined,
        postcode: venueValue.postcode || undefined,
        country: venueValue.country || undefined,
        latitude: venueValue.latitude ?? undefined,
        longitude: venueValue.longitude ?? undefined,
        placeId: venueValue.placeId || undefined,
        parkingInfo: parking.trim() || undefined,
        accessInfo: access.trim() || undefined,
        equipmentAvailable: equipment.trim() || undefined,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      onChange(created.id);
      setVenueValue(EMPTY_VENUE);
      setShowMore(false);
      setParking('');
      setAccess('');
      setEquipment('');
      setLocalError(null);
    },
    onError: () => {
      setLocalError('Failed to create venue. Please try again.');
    },
  });

  function handleCreate() {
    if (!venueValue.name.trim()) {
      setLocalError('Venue name is required');
      return;
    }
    setLocalError(null);
    createMutation.mutate();
  }

  const setAddressField =
    (field: keyof VenuePlaceValue) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setVenueValue((v) => ({ ...v, [field]: e.target.value, placeId: null, latitude: null, longitude: null }));

  function handleVenueChange(next: VenuePlaceValue) {
    setVenueValue(next);
    // A plain-address selection (a private house, a field) fills the address but no
    // business name, leaving the search box blank. Auto-open details so the captured
    // address is visible and the musician can name the venue.
    const hasAddress = !!(next.addressLine1 || next.city || next.postcode);
    if (hasAddress && !next.name.trim()) setShowMore(true);
  }

  const dirty = !!onSave && (value || null) !== (committedValue ?? null);

  const header = (
    <div className="flex items-center gap-1.5">
      <MapPin size={16} className="text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-semibold">
        Venue <span className="font-normal text-muted-foreground">(optional)</span>
      </p>
    </div>
  );

  return (
    <div className="border border-border rounded-md p-4 space-y-3">
      {value ? (
        // Attached: show the selected venue (clear with the ✕ to detach)
        <>
          {header}
          <ContactPicker
            value={value}
            onChange={onChange}
            placeholder="Select venue..."
            label="venue"
            preferredRole="VENUE"
            disableCreate
          />
        </>
      ) : (
        <Tabs value={mode} onValueChange={(v) => setMode(v as 'existing' | 'new')}>
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
              value={value}
              onChange={onChange}
              placeholder="Select venue..."
              label="venue"
              preferredRole="VENUE"
              disableCreate
            />
          </TabsContent>

          <TabsContent value="new" className="mt-3 space-y-3">
            {/* Wrapper intercepts Enter: VenuePlaceSearch handles it when suggestions are open;
                wrapper prevents outer form submission when there are no suggestions */}
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

            <div className="flex items-center gap-3">
              <Button type="button" onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating…' : 'Create venue'}
              </Button>
              {localError && (
                <p className="text-sm text-status-cancelled">{localError}</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {onSave && dirty && (
        <div className="flex items-center gap-3">
          <Button type="button" onClick={() => onSave(value)} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
          {saveError && <p className="text-sm text-status-cancelled">{saveError}</p>}
        </div>
      )}

      {error && <p className="text-sm text-status-cancelled">{error}</p>}
    </div>
  );
}
