import { useEffect, useMemo, useRef, useState } from 'react';
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

// ─── Progressive disclosure ────────────────────────────────────────────────────

type RoleKey = 'CUSTOMER' | 'VENUE' | 'BOOKING_AGENT';
type RoleField =
  | 'phone'
  | 'notes'
  | 'address'
  | 'parkingInfo'
  | 'accessInfo'
  | 'equipmentAvailable'
  | 'website'
  | 'commissionArrangement';

// Fields each role "claims" — overlapping fields (phone, address) render exactly
// once via the deduplication in computeSections.
const ROLE_FIELDS: Record<RoleKey, RoleField[]> = {
  CUSTOMER: ['phone', 'notes'],
  VENUE: ['address', 'parkingInfo', 'accessInfo', 'equipmentAvailable'],
  BOOKING_AGENT: ['phone', 'address', 'website', 'commissionArrangement'],
};

const ROLE_LABEL: Record<RoleKey, string> = {
  CUSTOMER: 'customer',
  VENUE: 'venue',
  BOOKING_AGENT: 'agent',
};

const DISCLOSURE_ORDER: RoleKey[] = ['CUSTOMER', 'VENUE', 'BOOKING_AGENT'];

// Active section gets all its fields; disclosures get theirs minus already-rendered.
function computeSections(activeRole: string) {
  if (!activeRole || !(activeRole in ROLE_FIELDS)) {
    return { activeFields: [] as RoleField[], disclosures: [] as { role: RoleKey; fields: RoleField[] }[] };
  }
  const rendered = new Set<RoleField>();
  const activeFields = [...ROLE_FIELDS[activeRole as RoleKey]];
  activeFields.forEach(f => rendered.add(f));
  const disclosures = DISCLOSURE_ORDER
    .filter(r => r !== activeRole)
    .map(role => {
      const fields = ROLE_FIELDS[role].filter(f => !rendered.has(f));
      fields.forEach(f => rendered.add(f));
      return { role, fields };
    });
  return { activeFields, disclosures };
}

// ─── Form ─────────────────────────────────────────────────────────────────────

interface ContactFormProps {
  defaultValues?: ContactFormValues;
  onSubmit: (values: ContactFormValues) => void;
  isPending: boolean;
  isError: boolean;
  submitLabel?: string;
  onCancel?: () => void;
  autoSuggestGreetingName?: boolean;
  contextRole?: RoleKey;
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

  const selectedRole = watch('primaryRole');
  const [openDisclosures, setOpenDisclosures] = useState<Set<string>>(new Set());
  const prevRoleRef = useRef(selectedRole);

  useEffect(() => {
    if (prevRoleRef.current !== selectedRole) {
      setOpenDisclosures(new Set());
      prevRoleRef.current = selectedRole;
    }
  }, [selectedRole]);

  const { activeFields, disclosures } = useMemo(
    () => computeSections(selectedRole),
    [selectedRole],
  );

  function toggleDisclosure(role: string) {
    setOpenDisclosures(prev => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  }

  function renderField(field: RoleField) {
    switch (field) {
      case 'phone':
        return (
          <FormField label="Phone" error={errors.phone?.message}>
            <Input type="tel" {...register('phone')} />
          </FormField>
        );
      case 'notes':
        return (
          <FormField label="Notes" error={errors.notes?.message}>
            <Textarea {...register('notes')} rows={3} />
          </FormField>
        );
      case 'address':
        return (
          <FormField label="Address">
            <Controller
              name="addressLine1"
              control={control}
              render={() => (
                <AddressAutocomplete
                  value={addressValue}
                  onChange={handleAddressChange}
                />
              )}
            />
          </FormField>
        );
      case 'parkingInfo':
        return (
          <FormField label="Parking" error={errors.parkingInfo?.message}>
            <Textarea {...register('parkingInfo')} rows={2} />
          </FormField>
        );
      case 'accessInfo':
        return (
          <FormField label="Access" error={errors.accessInfo?.message}>
            <Textarea {...register('accessInfo')} rows={2} />
          </FormField>
        );
      case 'equipmentAvailable':
        return (
          <FormField label="Equipment available" error={errors.equipmentAvailable?.message}>
            <Textarea {...register('equipmentAvailable')} rows={2} />
          </FormField>
        );
      case 'website':
        return (
          <FormField label="Website" error={errors.website?.message}>
            <Input type="url" {...register('website')} placeholder="https://" />
          </FormField>
        );
      case 'commissionArrangement':
        return (
          <FormField label="Commission arrangement" error={errors.commissionArrangement?.message}>
            <Textarea {...register('commissionArrangement')} rows={2} />
          </FormField>
        );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

      {/* Contact Type — first field, drives progressive disclosure */}
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

      {/* Core fields — always visible */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Name" required error={errors.name?.message}>
            <Input {...register('name')} autoFocus />
          </FormField>
          <FormField label="Greeting name" error={errors.greetingName?.message}>
            <Input {...greetingNameRegistration} placeholder="e.g. Jane" />
          </FormField>
        </div>
        <FormField label="Email" error={errors.email?.message}>
          <Input type="email" {...register('email')} />
        </FormField>
      </div>

      {/* Role-aware section */}
      {selectedRole ? (
        <div className="space-y-6">
          {/* Active type's fields */}
          {activeFields.length > 0 && (
            <div className="space-y-4">
              {activeFields.map(field => (
                <div key={field}>{renderField(field)}</div>
              ))}
            </div>
          )}

          {/* Disclosures for other types */}
          {disclosures
            .filter(({ fields }) => fields.length > 0)
            .map(({ role, fields }) => (
              <div key={role} className="space-y-4">
                <button
                  type="button"
                  onClick={() => toggleDisclosure(role)}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {openDisclosures.has(role) ? (
                    <>
                      <ChevronUp className="h-4 w-4" aria-hidden="true" />
                      Hide {ROLE_LABEL[role]} fields
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                      Show {ROLE_LABEL[role]} fields
                    </>
                  )}
                </button>
                {openDisclosures.has(role) && (
                  <div className="space-y-4">
                    {fields.map(field => (
                      <div key={field}>{renderField(field)}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
        </div>
      ) : (
        /* No type selected: flat layout — all fields visible */
        <>
          <div className="space-y-4">
            {renderField('phone')}
            {renderField('website')}
            {renderField('address')}
            {renderField('notes')}
          </div>
          <div className="space-y-4">
            <p className="text-sm font-medium text-foreground">Venue details</p>
            {renderField('parkingInfo')}
            {renderField('accessInfo')}
            {renderField('equipmentAvailable')}
          </div>
          {renderField('commissionArrangement')}
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
        {isError && (
          <p className="text-sm text-status-cancelled">Something went wrong</p>
        )}
      </div>
    </form>
  );
}
