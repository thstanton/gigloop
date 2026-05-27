import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { Contact, CreateContactInput, UpdateContactInput } from '@/types/api';
import { cn } from '@/lib/utils';

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  greetingName: z.string(),
  email: z.string().email('Invalid email').or(z.literal('')),
  phone: z.string(),
  website: z.string().url('Invalid URL').or(z.literal('')),
  address: z.string(),
  notes: z.string(),
  parkingInfo: z.string(),
  accessInfo: z.string(),
  equipmentAvailable: z.string(),
  commissionArrangement: z.string(),
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
    address: values.address || null,
    notes: values.notes || null,
    parkingInfo: values.parkingInfo || null,
    accessInfo: values.accessInfo || null,
    equipmentAvailable: values.equipmentAvailable || null,
    commissionArrangement: values.commissionArrangement || null,
  };
}

export function contactToFormValues(c: Contact): ContactFormValues {
  return {
    name: c.name,
    greetingName: c.greetingName ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    website: c.website ?? '',
    address: c.address ?? '',
    notes: c.notes ?? '',
    parkingInfo: c.parkingInfo ?? '',
    accessInfo: c.accessInfo ?? '',
    equipmentAvailable: c.equipmentAvailable ?? '',
    commissionArrangement: c.commissionArrangement ?? '',
  };
}

// ─── Field helper ─────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  error,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label>
        {label}
        {required && <span className="text-status-cancelled ml-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="text-sm text-status-cancelled">{error}</p>}
    </div>
  );
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
}

export default function ContactForm({
  defaultValues,
  onSubmit,
  isPending,
  isError,
  submitLabel = 'Save',
  onCancel,
  autoSuggestGreetingName = false,
}: ContactFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      name: '', greetingName: '', email: '', phone: '', website: '',
      address: '', notes: '', parkingInfo: '',
      accessInfo: '', equipmentAvailable: '', commissionArrangement: '',
    },
  });

  // Track whether the user has manually edited greetingName so we stop suggesting.
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

      {/* Core */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Name" required error={errors.name?.message}>
            <Input {...register('name')} autoFocus />
          </Field>
          <Field label="Greeting name" error={errors.greetingName?.message}>
            <Input
              {...greetingNameRegistration}
              placeholder="e.g. Jane"
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Email" error={errors.email?.message}>
            <Input type="email" {...register('email')} />
          </Field>
          <Field label="Phone" error={errors.phone?.message}>
            <Input type="tel" {...register('phone')} />
          </Field>
        </div>
        <Field label="Website" error={errors.website?.message}>
          <Input type="url" {...register('website')} placeholder="https://" />
        </Field>
        <Field label="Address" error={errors.address?.message}>
          <Textarea {...register('address')} rows={3} />
        </Field>
        <Field label="Notes" error={errors.notes?.message}>
          <Textarea {...register('notes')} rows={3} />
        </Field>
      </div>

      {/* Venue extras */}
      <div className="space-y-4">
        <p className="text-sm font-medium text-foreground">Venue details</p>
        <Field label="Parking" error={errors.parkingInfo?.message}>
          <Textarea {...register('parkingInfo')} rows={2} />
        </Field>
        <Field label="Access" error={errors.accessInfo?.message}>
          <Textarea {...register('accessInfo')} rows={2} />
        </Field>
        <Field label="Equipment available" error={errors.equipmentAvailable?.message}>
          <Textarea {...register('equipmentAvailable')} rows={2} />
        </Field>
      </div>

      {/* Commission */}
      <Field label="Commission arrangement" error={errors.commissionArrangement?.message}>
        <Textarea {...register('commissionArrangement')} rows={2} />
      </Field>

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
