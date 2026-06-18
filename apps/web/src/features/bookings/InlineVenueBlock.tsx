import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
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
}

export function InlineVenueBlock({ value, onChange, error }: InlineVenueBlockProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [venueValue, setVenueValue] = useState<VenuePlaceValue>(EMPTY_VENUE);
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
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      onChange(created.id);
      setMode('existing');
      setVenueValue(EMPTY_VENUE);
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

  return (
    <div className="border border-border rounded-md p-4 space-y-3">
      <Tabs value={mode} onValueChange={(v) => setMode(v as 'existing' | 'new')}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">
            Venue <span className="font-normal text-muted-foreground">(optional)</span>
          </p>
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
            value={value}
            onChange={onChange}
            placeholder="Select venue..."
            label="venue"
            preferredRole="VENUE"
            disableCreate
          />
        </TabsContent>

        <TabsContent value="new" className="mt-3 space-y-3">
          {/* Wrapper intercepts Enter to prevent outer form submission when VenuePlaceSearch has no suggestions */}
          <div onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}>
            <VenuePlaceSearch value={venueValue} onChange={setVenueValue} />
          </div>

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

      {error && <p className="text-sm text-status-cancelled">{error}</p>}
    </div>
  );
}
