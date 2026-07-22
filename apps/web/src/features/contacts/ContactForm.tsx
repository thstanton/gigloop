import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormField } from '@/components/common/FormField';
import { AddressAutocomplete } from '@/components/common/AddressAutocomplete';
import { VenuePlaceSearch, type VenuePlaceValue } from '@/components/common/VenuePlaceSearch';
import type { Contact, CreateContactInput, UpdateContactInput } from '@/types/api';

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  greetingName: z.string(),
  email: z.string().email('Invalid email').or(z.literal('')),
  phone: z.string(),
  website: z.string().url('Invalid URL').or(z.literal('')),
  addressLine1: z.string(),
  addressLine2: z.string(),
  city: z.string(),
  county: z.string(),
  postcode: z.string(),
  country: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  placeId: z.string().nullable(),
  notes: z.string(),
  parkingInfo: z.string(),
  accessInfo: z.string(),
  equipmentAvailable: z.string(),
  commissionArrangement: z.string(),
  primaryRole: z.enum(['CUSTOMER', 'VENUE', 'BOOKING_AGENT', '']),
});

export type ContactFormValues = z.infer<typeof schema>;

export function toContactPayload(
  values: ContactFormValues,
): CreateContactInput | UpdateContactInput {
  return {
    name: values.name,
    greetingName: values.greetingName || null,
    email: values.email || null,
    phone: values.phone || null,
    website: values.website || null,
    addressLine1: values.addressLine1 || null,
    addressLine2: values.addressLine2 || null,
    city: values.city || null,
    county: values.county || null,
    postcode: values.postcode || null,
    country: values.country || null,
    latitude: values.latitude,
    longitude: values.longitude,
    placeId: values.placeId,
    notes: values.notes || null,
    parkingInfo: values.parkingInfo || null,
    accessInfo: values.accessInfo || null,
    equipmentAvailable: values.equipmentAvailable || null,
    commissionArrangement: values.commissionArrangement || null,
    primaryRole: values.primaryRole || null,
  };
}

export function contactToFormValues(c: Contact): ContactFormValues {
  return {
    name: c.name,
    greetingName: c.greetingName ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    website: c.website ?? '',
    addressLine1: c.addressLine1 ?? '',
    addressLine2: c.addressLine2 ?? '',
    city: c.city ?? '',
    county: c.county ?? '',
    postcode: c.postcode ?? '',
    country: c.country ?? 'GB',
    latitude: c.latitude,
    longitude: c.longitude,
    placeId: c.placeId,
    notes: c.notes ?? '',
    parkingInfo: c.parkingInfo ?? '',
    accessInfo: c.accessInfo ?? '',
    equipmentAvailable: c.equipmentAvailable ?? '',
    commissionArrangement: c.commissionArrangement ?? '',
    primaryRole: (c.primaryRole as ContactFormValues['primaryRole']) ?? '',
  };
}

// ─── Form ─────────────────────────────────────────────────────────────────────

type RoleKey = 'CUSTOMER' | 'VENUE' | 'BOOKING_AGENT';

interface ContactFormProps {
  defaultValues?: ContactFormValues;
  onSubmit: (values: ContactFormValues) => void;
  isPending: boolean;
  isError: boolean;
  submitLabel?: string;
  onCancel?: () => void;
  autoSuggestGreetingName?: boolean;
  contextRole?: RoleKey;
  /**
   * Embedded presentation for rendering inside a booking's People/Venue card:
   * hides the Contact Type select, keeps only Name/Greeting/Email/Phone visible,
   * and folds Address, Notes and the role-specific block behind a single
   * "Add contact details" disclosure. VENUE keeps its address visible.
   */
  embedded?: boolean;
  /** Tier-1 inline-save marker — shows "Saved" next to the submit when true and not pending. */
  saved?: boolean;
}

export default function ContactForm({
  defaultValues,
  onSubmit,
  isPending,
  isError,
  submitLabel = 'Save',
  onCancel,
  autoSuggestGreetingName = false,
  contextRole,
  embedded = false,
  saved = false,
}: ContactFormProps) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      name: '', greetingName: '', email: '', phone: '', website: '',
      addressLine1: '', addressLine2: '', city: '', county: '',
      postcode: '', country: 'GB', latitude: null, longitude: null, placeId: null,
      notes: '', parkingInfo: '', accessInfo: '', equipmentAvailable: '',
      commissionArrangement: '', primaryRole: contextRole ?? '',
    },
  });

  const greetingNameEdited = useRef(false);
  const watchedName = watch('name');

  useEffect(() => {
    if (!autoSuggestGreetingName || greetingNameEdited.current) return;
    const suggested = watchedName.trim().split(/\s+/)[0] ?? '';
    setValue('greetingName', suggested, { shouldDirty: false });
  }, [watchedName, autoSuggestGreetingName, setValue]);

  const greetingNameRegistration = register('greetingName', {
    onChange: () => { greetingNameEdited.current = true; },
  });

  const addressValue = {
    addressLine1: watch('addressLine1'),
    addressLine2: watch('addressLine2'),
    city: watch('city'),
    county: watch('county'),
    postcode: watch('postcode'),
    country: watch('country'),
    latitude: watch('latitude'),
    longitude: watch('longitude'),
    placeId: watch('placeId'),
  };

  const handleAddressChange = (v: typeof addressValue) => {
    setValue('addressLine1', v.addressLine1, { shouldDirty: true });
    setValue('addressLine2', v.addressLine2, { shouldDirty: true });
    setValue('city', v.city, { shouldDirty: true });
    setValue('county', v.county, { shouldDirty: true });
    setValue('postcode', v.postcode, { shouldDirty: true });
    setValue('country', v.country, { shouldDirty: true });
    setValue('latitude', v.latitude, { shouldDirty: true });
    setValue('longitude', v.longitude, { shouldDirty: true });
    setValue('placeId', v.placeId, { shouldDirty: true });
  };

  // Venue contacts use the venue-aware search so picking an establishment fills the
  // Name field too (matching the inline booking flow). The search box echoes value.name,
  // which is two-way bound to the always-visible Name field above.
  const venuePlaceValue: VenuePlaceValue = { name: watch('name'), ...addressValue };
  const handleVenuePlaceChange = (v: VenuePlaceValue) => {
    setValue('name', v.name, { shouldDirty: true });
    handleAddressChange(v);
  };

  const selectedRole = watch('primaryRole');
  // In embedded mode the booking role (contextRole) decides which role-specific block and the
  // venue-address carve-out apply — not the contact's stored primaryRole, which still round-trips
  // unchanged through submit. Outside embedded mode the Contact Type select drives it, as before.
  const embeddedRole = contextRole ?? selectedRole;
  const isVenue = embedded ? embeddedRole === 'VENUE' : selectedRole === 'VENUE';
  const isAgent = embedded ? embeddedRole === 'BOOKING_AGENT' : selectedRole === 'BOOKING_AGENT';
  const [venueOpen, setVenueOpen] = useState(isVenue);
  const [agentOpen, setAgentOpen] = useState(isAgent);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const prevRoleRef = useRef(selectedRole);

  // When Contact Type changes, auto-open the matching disclosure and close the other.
  useEffect(() => {
    if (prevRoleRef.current === selectedRole) return;
    prevRoleRef.current = selectedRole;
    setVenueOpen(selectedRole === 'VENUE');
    setAgentOpen(selectedRole === 'BOOKING_AGENT');
  }, [selectedRole]);

  // Field fragments — placed differently by mode. In embedded mode Address/Notes and
  // the role block fold behind one disclosure; the full editor keeps them inline with
  // the two role-specific disclosures.
  const addressField = (
    <FormField label={isVenue ? 'Find venue' : 'Address'}>
      <Controller
        name="addressLine1"
        control={control}
        render={() =>
          isVenue ? (
            <VenuePlaceSearch value={venuePlaceValue} onChange={handleVenuePlaceChange} />
          ) : (
            <AddressAutocomplete value={addressValue} onChange={handleAddressChange} />
          )
        }
      />
    </FormField>
  );

  const notesField = (
    <FormField label="Notes" error={errors.notes?.message}>
      <Textarea {...register('notes')} rows={3} />
    </FormField>
  );

  const venueFieldsContent = (
    <div className="space-y-4">
      <FormField label="Parking" error={errors.parkingInfo?.message}>
        <Textarea {...register('parkingInfo')} rows={2} />
      </FormField>
      <FormField label="Access" error={errors.accessInfo?.message}>
        <Textarea {...register('accessInfo')} rows={2} />
      </FormField>
      <FormField label="Equipment available" error={errors.equipmentAvailable?.message}>
        <Textarea {...register('equipmentAvailable')} rows={2} />
      </FormField>
    </div>
  );

  const agentFieldsContent = (
    <div className="space-y-4">
      <FormField label="Website" error={errors.website?.message}>
        <Input type="url" {...register('website')} placeholder="https://" />
      </FormField>
      <FormField label="Commission arrangement" error={errors.commissionArrangement?.message}>
        <Textarea {...register('commissionArrangement')} rows={2} />
      </FormField>
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

      {/* Contact Type — full editor only. In embedded mode the card's role implies it,
          and primaryRole round-trips via defaultValues even though it isn't rendered. */}
      {!embedded && (
        <FormField label="Contact Type" error={errors.primaryRole?.message}>
          <Controller
            name="primaryRole"
            control={control}
            render={({ field }) => (
              <Select value={field.value || 'NONE'} onValueChange={(v) => field.onChange(v === 'NONE' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="No contact type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">No contact type</SelectItem>
                  <SelectItem value="CUSTOMER">Customer</SelectItem>
                  <SelectItem value="VENUE">Venue</SelectItem>
                  <SelectItem value="BOOKING_AGENT">Booking agent</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
      )}

      {/* Core — always visible for every contact */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Name" required error={errors.name?.message}>
            <Input {...register('name')} autoFocus={!embedded} />
          </FormField>
          <FormField label="Greeting name" error={errors.greetingName?.message}>
            <Input {...greetingNameRegistration} placeholder="e.g. Jane" />
          </FormField>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Email" error={errors.email?.message}>
            <Input type="email" {...register('email')} />
          </FormField>
          <FormField label="Phone" error={errors.phone?.message}>
            <Input type="tel" {...register('phone')} />
          </FormField>
        </div>
        {/* Venue keeps its address visible — for a venue the address is the identity. */}
        {(!embedded || isVenue) && addressField}
        {!embedded && notesField}
      </div>

      {embedded ? (
        /* One disclosure folds the remaining detail. Only the role-matched block is
           offered — the contact's role is fixed here, so the other blocks are noise. */
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setDetailsOpen((o) => !o)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {detailsOpen ? (
              <><ChevronUp className="h-4 w-4" aria-hidden="true" />Hide contact details</>
            ) : (
              <><ChevronDown className="h-4 w-4" aria-hidden="true" />Add contact details</>
            )}
          </button>
          {detailsOpen && (
            <div className="space-y-4">
              {!isVenue && addressField}
              {notesField}
              {isVenue && venueFieldsContent}
              {isAgent && agentFieldsContent}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Venue-specific fields */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setVenueOpen((o) => !o)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {venueOpen ? (
                <><ChevronUp className="h-4 w-4" aria-hidden="true" />Hide venue fields</>
              ) : (
                <><ChevronDown className="h-4 w-4" aria-hidden="true" />Show venue fields</>
              )}
            </button>
            {venueOpen && venueFieldsContent}
          </div>

          {/* Agent-specific fields */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setAgentOpen((o) => !o)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {agentOpen ? (
                <><ChevronUp className="h-4 w-4" aria-hidden="true" />Hide agent fields</>
              ) : (
                <><ChevronDown className="h-4 w-4" aria-hidden="true" />Show agent fields</>
              )}
            </button>
            {agentOpen && agentFieldsContent}
          </div>
        </>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {saved && !isPending && <span className="text-xs text-muted">Saved</span>}
        {isError && (
          <p className="text-sm text-status-cancelled">Something went wrong</p>
        )}
      </div>
    </form>
  );
}
