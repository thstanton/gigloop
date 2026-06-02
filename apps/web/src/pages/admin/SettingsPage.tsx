import { useEffect, useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronRight, ImageIcon, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import type { PublicProfile, UserProfile, UpdatePublicProfileInput, UpdateUserProfileInput, UserPreferences, DueDateRule, ChecklistDefaultItem, InvoiceNumberFormat, PaddingWidth } from '@/types/api';
import { cn } from '@/lib/utils';
import { Card } from '@/components/common/Card';
import { PageSection } from '@/components/common/PageSection';
import { FormField } from '@/components/common/FormField';
import { AddressAutocomplete } from '@/components/common/AddressAutocomplete';

// ─── Schemas ─────────────────────────────────────────────────────────────────

const publicSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  displayName: z.string(),
  email: z.string().email('Invalid email').or(z.literal('')),
  phone: z.string(),
  bio: z.string(),
  website: z.string().url('Invalid URL').or(z.literal('')),
});

type PublicForm = z.infer<typeof publicSchema>;

const businessSchema = z.object({
  addressLine1: z.string(),
  addressLine2: z.string(),
  city: z.string(),
  county: z.string(),
  postcode: z.string(),
  country: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  placeId: z.string().nullable(),
  bankDetails: z.string(),
  vatRegistered: z.boolean(),
  vatNumber: z.string(),
  vatRate: z.number().int().min(0, 'Must be 0–100').max(100, 'Must be 0–100'),
  defaultPaymentTermsDays: z.number().int().min(0, 'Must be 0 or more'),
  depositPercentage: z.union([
    z.nan().transform((): undefined => undefined),
    z.number().int().min(1, 'Must be 1–100').max(100, 'Must be 1–100'),
  ]).optional(),
});

type BusinessForm = z.infer<typeof businessSchema>;

const notificationsSchema = z.object({
  digestEmailEnabled: z.boolean(),
  reminderLeadDays: z.number().int().min(1).max(90),
});

type NotificationsForm = z.infer<typeof notificationsSchema>;

const PADDING_OPTIONS: PaddingWidth[] = [1, 3, 4, 6];

const paddingWidthSchema = z.union([z.literal(1), z.literal(3), z.literal(4), z.literal(6)]);

const invoiceNumberSchema = z.object({
  prefix: z.string().max(20, 'Max 20 characters'),
  includeYear: z.boolean(),
  paddingWidth: paddingWidthSchema,
});

type InvoiceNumberForm = z.infer<typeof invoiceNumberSchema>;

const FORMAT_DEFAULTS: InvoiceNumberFormat = { prefix: 'INV', includeYear: true, paddingWidth: 3 };

function previewInvoiceNumber(seq: number, year: number, form: InvoiceNumberForm): string {
  const { prefix, includeYear, paddingWidth } = form;
  const seqStr = String(seq).padStart(paddingWidth, '0');
  const parts = [...(prefix ? [prefix] : []), ...(includeYear ? [String(year)] : []), seqStr];
  return parts.join('-');
}

const bookingGeneralSchema = z.object({
  songRequestFormEnabled: z.boolean(),
  defaultBookingStatus: z.enum(['ENQUIRY', 'PROVISIONAL', 'CONFIRMED']),
});

type BookingGeneralForm = z.infer<typeof bookingGeneralSchema>;


function SubsectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
    </div>
  );
}

function SaveBar({
  isPending,
  saved,
  isError,
  onSave,
}: {
  isPending: boolean;
  saved: boolean;
  isError: boolean;
  onSave?: () => void;
}) {
  return (
    <div className="flex items-center gap-4 pt-2">
      <Button type={onSave ? 'button' : 'submit'} onClick={onSave} disabled={isPending}>
        {isPending ? 'Saving…' : 'Save changes'}
      </Button>
      {saved && !isPending && <span className="text-sm text-muted">Saved</span>}
      {isError && !isPending && (
        <span className="text-sm text-status-cancelled">Something went wrong</span>
      )}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        'relative inline-flex w-9 h-5 rounded-full transition-colors duration-150 flex-shrink-0',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        checked && !disabled ? 'bg-primary' : 'bg-border',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-150',
          checked ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  );
}

// ─── Image upload field ───────────────────────────────────────────────────────

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

function ImageUploadField({
  label,
  description,
  currentUrl,
  uploading,
  removing,
  onFileSelect,
  onRemove,
  variant = 'square',
  maxSizeBytes = MAX_UPLOAD_BYTES,
}: {
  label: string;
  description?: string;
  currentUrl: string | null;
  uploading: boolean;
  removing: boolean;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
  variant?: 'square' | 'landscape';
  maxSizeBytes?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  let uploadLabel: string;
  if (uploading) uploadLabel = 'Uploading…';
  else if (currentUrl) uploadLabel = 'Change';
  else uploadLabel = 'Upload';

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {description && <p className="text-xs text-muted">{description}</p>}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'border border-border bg-muted/30 flex items-center justify-center overflow-hidden flex-shrink-0',
            variant === 'landscape' ? 'w-32 h-12 rounded-md' : 'w-12 h-12 rounded-full',
          )}
        >
          {currentUrl ? (
            <img
              src={currentUrl}
              alt={label}
              className={cn(
                variant === 'landscape'
                  ? 'max-w-full max-h-full object-contain p-1'
                  : 'w-full h-full object-cover',
              )}
            />
          ) : (
            <ImageIcon size={18} className="text-muted" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading || removing}
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={14} className="mr-1.5" />
            {uploadLabel}
          </Button>
          {currentUrl && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading || removing}
              onClick={onRemove}
            >
              <Trash2 size={14} className="mr-1.5" />
              {removing ? 'Removing…' : 'Remove'}
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > maxSizeBytes) {
              toast({ title: `File too large — maximum size is ${Math.round(maxSizeBytes / 1024 / 1024)} MB`, variant: 'destructive' });
              e.target.value = '';
              return;
            }
            onFileSelect(file);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}

// ─── Public profile section ───────────────────────────────────────────────────

function PublicProfileSection({ profile }: { profile: PublicProfile }) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);

  const defaults = {
    businessName: profile.businessName,
    displayName: profile.displayName ?? '',
    email: profile.email ?? '',
    phone: profile.phone ?? '',
    bio: profile.bio ?? '',
    website: profile.website ?? '',
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PublicForm>({ resolver: zodResolver(publicSchema), defaultValues: defaults });

  useEffect(() => { reset(defaults); }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: (data: UpdatePublicProfileInput) => apiPatch<PublicProfile>('/me/public', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publicProfile'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const logoUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const { uploadUrl, publicUrl } = await apiPost<{ uploadUrl: string; publicUrl: string }>(
        '/me/logo-upload-url',
        { contentType: file.type },
      );
      await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      await apiPatch<PublicProfile>('/me/public', { logoUrl: publicUrl });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['publicProfile'] }),
    onError: () => toast({ title: 'Failed to upload logo', variant: 'destructive' }),
  });

  const logoDeleteMutation = useMutation({
    mutationFn: () => apiDelete('/me/logo'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['publicProfile'] }),
    onError: () => toast({ title: 'Failed to remove logo', variant: 'destructive' }),
  });

  const photoUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const { uploadUrl, publicUrl } = await apiPost<{ uploadUrl: string; publicUrl: string }>(
        '/me/photo-upload-url',
        { contentType: file.type },
      );
      await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      await apiPatch<PublicProfile>('/me/public', { photo: publicUrl });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['publicProfile'] }),
    onError: () => toast({ title: 'Failed to upload photo', variant: 'destructive' }),
  });

  const photoDeleteMutation = useMutation({
    mutationFn: () => apiDelete('/me/photo'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['publicProfile'] }),
    onError: () => toast({ title: 'Failed to remove photo', variant: 'destructive' }),
  });

  function onSubmit(values: PublicForm) {
    mutation.mutate({
      businessName: values.businessName,
      displayName: values.displayName || null,
      email: values.email || null,
      phone: values.phone || null,
      bio: values.bio || null,
      website: values.website || null,
    });
  }

  return (
    <div className="space-y-5">
      <PageSection
        title="Public profile"
        description="Shown on your client portal and in emails."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ImageUploadField
          label="Logo"
          description="Used on invoices and your client portal."
          currentUrl={profile.logoUrl}
          uploading={logoUploadMutation.isPending}
          removing={logoDeleteMutation.isPending}
          onFileSelect={(file) => logoUploadMutation.mutate(file)}
          onRemove={() => logoDeleteMutation.mutate()}
          variant="landscape"
        />
        <ImageUploadField
          label="Photo"
          description="Your headshot — shown on the client portal."
          currentUrl={profile.photo}
          uploading={photoUploadMutation.isPending}
          removing={photoDeleteMutation.isPending}
          onFileSelect={(file) => photoUploadMutation.mutate(file)}
          onRemove={() => photoDeleteMutation.mutate()}
          variant="square"
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Business name" required error={errors.businessName?.message}>
          <Input {...register('businessName')} />
        </FormField>
        <FormField label="Display name" error={errors.displayName?.message}>
          <Input {...register('displayName')} placeholder="e.g. John Smith" />
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

      <FormField label="Bio" error={errors.bio?.message}>
        <Textarea
          {...register('bio')}
          rows={3}
          placeholder="A short introduction for your clients"
        />
      </FormField>

      <FormField label="Website" error={errors.website?.message}>
        <Input type="url" {...register('website')} placeholder="https://" />
      </FormField>

      <SaveBar isPending={mutation.isPending} saved={saved} isError={mutation.isError} />
    </form>
    </div>
  );
}

// ─── Portal section ───────────────────────────────────────────────────────────

function PortalSection() {
  return (
    <div>
      <PageSection
        title="Portal"
        description="Customise your client portal's appearance and branding."
      />
      <Link
        to="/admin/portal-preview"
        className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-3 text-sm text-foreground hover:bg-accent transition-colors"
      >
        Configure portal
        <ChevronRight size={14} className="text-muted" />
      </Link>
    </div>
  );
}

// ─── Business details section ─────────────────────────────────────────────────

function BusinessDetailsSection({ profile }: { profile: UserProfile }) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);

  const defaults = {
    addressLine1: profile.addressLine1 ?? '',
    addressLine2: profile.addressLine2 ?? '',
    city: profile.city ?? '',
    county: profile.county ?? '',
    postcode: profile.postcode ?? '',
    country: profile.country ?? 'GB',
    latitude: profile.latitude ?? null,
    longitude: profile.longitude ?? null,
    placeId: profile.placeId ?? null,
    bankDetails: profile.bankDetails ?? '',
    vatRegistered: !!(profile.vatNumber),
    vatNumber: profile.vatNumber ?? '',
    vatRate: profile.vatRate ?? 20,
    defaultPaymentTermsDays: profile.defaultPaymentTermsDays,
    depositPercentage: profile.depositPercentage ?? undefined,
  };

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BusinessForm>({ resolver: zodResolver(businessSchema), defaultValues: defaults });

  const vatRegistered = watch('vatRegistered');

  useEffect(() => { reset(defaults); }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: (data: UpdateUserProfileInput) => apiPatch<UserProfile>('/me', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  function onSubmit(values: BusinessForm) {
    mutation.mutate({
      addressLine1: values.addressLine1 || null,
      addressLine2: values.addressLine2 || null,
      city: values.city || null,
      county: values.county || null,
      postcode: values.postcode || null,
      country: values.country || null,
      latitude: values.latitude,
      longitude: values.longitude,
      placeId: values.placeId,
      bankDetails: values.bankDetails || null,
      vatNumber: values.vatRegistered ? (values.vatNumber || null) : null,
      ...(values.vatRegistered ? { vatRate: values.vatRate } : {}),
      defaultPaymentTermsDays: values.defaultPaymentTermsDays,
      depositPercentage: values.depositPercentage,
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <PageSection
        title="Business details"
        description="Used on invoices and other client-facing documents."
      />

      <FormField label="Address">
        <Controller
          name="addressLine1"
          control={control}
          render={() => {
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
            return (
              <AddressAutocomplete
                value={addressValue}
                onChange={(v) => {
                  setValue('addressLine1', v.addressLine1, { shouldDirty: true });
                  setValue('addressLine2', v.addressLine2, { shouldDirty: true });
                  setValue('city', v.city, { shouldDirty: true });
                  setValue('county', v.county, { shouldDirty: true });
                  setValue('postcode', v.postcode, { shouldDirty: true });
                  setValue('country', v.country, { shouldDirty: true });
                  setValue('latitude', v.latitude, { shouldDirty: true });
                  setValue('longitude', v.longitude, { shouldDirty: true });
                  setValue('placeId', v.placeId, { shouldDirty: true });
                }}
              />
            );
          }}
        />
      </FormField>

      <FormField label="Bank details" error={errors.bankDetails?.message}>
        <Textarea
          {...register('bankDetails')}
          rows={3}
          placeholder="Sort code, account number, bank name"
        />
      </FormField>

      <Controller
        name="vatRegistered"
        control={control}
        render={({ field }) => (
          <label className="flex items-start gap-3 cursor-pointer">
            <Toggle checked={field.value} onChange={field.onChange} />
            <div className="-mt-0.5">
              <p className="text-sm font-medium text-foreground">VAT registered</p>
              <p className="text-xs text-muted mt-0.5">Show VAT number and rate fields on invoices</p>
            </div>
          </label>
        )}
      />

      {vatRegistered && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="VAT number" error={errors.vatNumber?.message}>
            <Input {...register('vatNumber')} placeholder="GB123456789" />
          </FormField>
          <FormField label="VAT rate (%)" error={errors.vatRate?.message}>
            <Input
              type="number"
              min={0}
              max={100}
              {...register('vatRate', { valueAsNumber: true })}
              className="w-20"
            />
          </FormField>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Default payment terms" error={errors.defaultPaymentTermsDays?.message}>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              {...register('defaultPaymentTermsDays', { valueAsNumber: true })}
              className="w-20"
            />
            <span className="text-sm text-muted">days</span>
          </div>
        </FormField>
        <FormField label="Default deposit" error={errors.depositPercentage?.message}>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={100}
              placeholder="e.g. 30"
              {...register('depositPercentage', { valueAsNumber: true })}
              className="w-20"
            />
            <span className="text-sm text-muted">% of fee</span>
          </div>
        </FormField>
      </div>

      <SaveBar isPending={mutation.isPending} saved={saved} isError={mutation.isError} />
    </form>
  );
}

// ─── Invoice settings section ─────────────────────────────────────────────────

function InvoiceSettingsSection({ profile }: { profile: UserProfile }) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);

  const prefs = (profile.preferences as UserPreferences | undefined)?.invoiceNumberFormat;
  const defaults: InvoiceNumberForm = {
    prefix: prefs?.prefix ?? FORMAT_DEFAULTS.prefix,
    includeYear: prefs?.includeYear ?? FORMAT_DEFAULTS.includeYear,
    paddingWidth: prefs?.paddingWidth ?? FORMAT_DEFAULTS.paddingWidth,
  };

  const { register, control, handleSubmit, reset, watch, formState: { errors } } = useForm<InvoiceNumberForm>({
    resolver: zodResolver(invoiceNumberSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    const p = (profile.preferences as UserPreferences | undefined)?.invoiceNumberFormat;
    reset({
      prefix: p?.prefix ?? FORMAT_DEFAULTS.prefix,
      includeYear: p?.includeYear ?? FORMAT_DEFAULTS.includeYear,
      paddingWidth: p?.paddingWidth ?? FORMAT_DEFAULTS.paddingWidth,
    });
  }, [profile, reset]);

  const formValues = watch();
  const currentYear = new Date().getFullYear();
  const isNewYear = formValues.includeYear && profile.invoiceSequenceYear !== currentYear;
  const nextSeq = isNewYear ? 1 : profile.invoiceNumberSequence + 1;
  const preview = previewInvoiceNumber(nextSeq, currentYear, formValues);

  const mutation = useMutation({
    mutationFn: (data: InvoiceNumberForm) =>
      apiPatch<UserProfile>('/me', { preferences: { invoiceNumberFormat: data } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
      <PageSection
        title="Invoice numbering"
        description="Control the format of invoice numbers generated when an invoice is sent."
      />

      <div className="space-y-5">
        <FormField label="Prefix" error={errors.prefix?.message}>
          <Input
            {...register('prefix')}
            placeholder="INV"
            maxLength={20}
            className="max-w-40"
          />
        </FormField>

        <Controller
          name="includeYear"
          control={control}
          render={({ field }) => (
            <label className="flex items-start gap-3 cursor-pointer">
              <Toggle checked={field.value} onChange={field.onChange} />
              <div className="-mt-0.5">
                <p className="text-sm font-medium text-foreground">Include year</p>
                <p className="text-xs text-muted mt-0.5">
                  Resets the sequence each calendar year when enabled
                </p>
              </div>
            </label>
          )}
        />

        <FormField label="Number padding" error={undefined}>
          <Controller
            name="paddingWidth"
            control={control}
            render={({ field }) => (
              <Select
                value={String(field.value)}
                onValueChange={(v) => field.onChange(Number(v) as PaddingWidth)}
              >
                <SelectTrigger className="max-w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PADDING_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {String(1).padStart(n, '0')} ({n} digit{n !== 1 ? 's' : ''})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>

        <div>
          <p className="text-sm font-medium text-foreground mb-1">Preview</p>
          <p className="font-mono text-base text-foreground">{preview}</p>
        </div>
      </div>

      <SaveBar isPending={mutation.isPending} saved={saved} isError={mutation.isError} />
    </form>
  );
}

// ─── Notifications section ────────────────────────────────────────────────────

function NotificationsSection({ profile }: { profile: UserProfile }) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);

  const defaults: NotificationsForm = {
    digestEmailEnabled: profile.digestEmailEnabled,
    reminderLeadDays: (profile.preferences as UserPreferences | undefined)?.reminderLeadDays ?? 7,
  };

  const { control, register, handleSubmit, reset, formState: { errors } } = useForm<NotificationsForm>({
    resolver: zodResolver(notificationsSchema),
    defaultValues: defaults,
  });

  useEffect(() => { reset(defaults); }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: ({ digestEmailEnabled, reminderLeadDays }: NotificationsForm) =>
      apiPatch<UserProfile>('/me', {
        digestEmailEnabled,
        preferences: { reminderLeadDays },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
      <PageSection
        title="Notifications"
        description="Control digest emails and automated reminder sending."
      />

      <div className="space-y-4">
        <Controller
          name="digestEmailEnabled"
          control={control}
          render={({ field }) => (
            <label className="flex items-start gap-3 cursor-pointer">
              <Toggle checked={field.value} onChange={field.onChange} />
              <div className="-mt-0.5">
                <p className="text-sm font-medium text-foreground">Weekly digest email</p>
                <p className="text-xs text-muted mt-0.5">
                  Summary of upcoming bookings and outstanding actions
                </p>
              </div>
            </label>
          )}
        />
      </div>

      <div>
        <p className="text-sm font-medium text-foreground">Reminder window</p>
        <p className="text-xs text-muted mt-0.5 mb-4">
          How many days before a checklist item's due date it appears in your digest and dashboard.
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
          <span className="text-sm text-foreground">Show items</span>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={90}
              {...register('reminderLeadDays', { valueAsNumber: true })}
              className="w-20"
            />
            <span className="text-sm text-muted">days before due date</span>
          </div>
          {errors.reminderLeadDays && (
            <p className="text-sm text-status-cancelled">{errors.reminderLeadDays.message}</p>
          )}
        </div>
      </div>

      <SaveBar isPending={mutation.isPending} saved={saved} isError={mutation.isError} />
    </form>
  );
}

// ─── Booking settings section ─────────────────────────────────────────────────

const CHECKLIST_STAGE_GROUPS: Array<{
  stage: 'PROVISIONAL' | 'CONFIRMED' | 'READY' | 'COMPLETE';
  label: string;
  items: Array<{
    key: string;
    label: string;
    completedBy: 'USER' | 'CUSTOMER';
    defaultDueDateRule: DueDateRule | null;
    musicFormGated?: boolean;
  }>;
}> = [
  {
    stage: 'PROVISIONAL',
    label: 'Provisional',
    items: [
      { key: 'send_quote', label: 'Send quote', completedBy: 'USER', defaultDueDateRule: { basis: 'bookingCreation', offsetDays: 2 } },
      { key: 'confirm_quote', label: 'Quote confirmed', completedBy: 'USER', defaultDueDateRule: null },
    ],
  },
  {
    stage: 'CONFIRMED',
    label: 'Confirmed',
    items: [
      { key: 'create_deposit_invoice', label: 'Create deposit invoice', completedBy: 'USER', defaultDueDateRule: null },
      { key: 'create_contract', label: 'Create contract', completedBy: 'USER', defaultDueDateRule: null },
      { key: 'send_contract', label: 'Send contract & deposit email', completedBy: 'USER', defaultDueDateRule: { basis: 'bookingDate', offsetDays: -60 } },
      { key: 'contract_signed', label: 'Contract signed', completedBy: 'CUSTOMER', defaultDueDateRule: { basis: 'bookingDate', offsetDays: -45 } },
      { key: 'deposit_received', label: 'Deposit received', completedBy: 'USER', defaultDueDateRule: { basis: 'bookingDate', offsetDays: -30 } },
    ],
  },
  {
    stage: 'READY',
    label: 'Ready',
    items: [
      { key: 'create_balance_invoice', label: 'Create balance invoice', completedBy: 'USER', defaultDueDateRule: { basis: 'bookingDate', offsetDays: -14 } },
      { key: 'music_form_invite', label: 'Send music form invite', completedBy: 'USER', defaultDueDateRule: { basis: 'bookingDate', offsetDays: -30 }, musicFormGated: true },
      { key: 'song_requests', label: 'Song requests received', completedBy: 'CUSTOMER', defaultDueDateRule: { basis: 'bookingDate', offsetDays: -14 }, musicFormGated: true },
    ],
  },
  {
    stage: 'COMPLETE',
    label: 'Complete',
    items: [
      { key: 'play_the_gig', label: 'Play the gig', completedBy: 'USER', defaultDueDateRule: { basis: 'bookingDate', offsetDays: 0 } },
      { key: 'send_thank_you', label: 'Send thank you', completedBy: 'USER', defaultDueDateRule: { basis: 'bookingDate', offsetDays: 7 } },
    ],
  },
];

const ALL_SYSTEM_KEYS = CHECKLIST_STAGE_GROUPS.flatMap((g) => g.items.map((i) => i.key));

function formatDueDateRule(rule: DueDateRule | null): string {
  if (!rule) return 'No due date';
  const days = Math.abs(rule.offsetDays);
  let direction: string;
  if (rule.offsetDays < 0) direction = 'before';
  else if (rule.offsetDays > 0) direction = 'after';
  else direction = 'on';
  const basis = rule.basis === 'bookingDate' ? 'booking date' : 'booking creation';
  if (direction === 'on') return `On ${basis}`;
  return `${days} day${days !== 1 ? 's' : ''} ${direction} ${basis}`;
}

type CustomItemForm = {
  label: string;
  completedBy: 'USER' | 'CUSTOMER';
  requiredForStatus: 'NONE' | 'CONFIRMED' | 'READY' | 'COMPLETE';
  dueDateBasis: 'bookingDate' | 'bookingCreation';
  dueDateOffset: string; // signed: negative = before
  hasDueDate: boolean;
};

function BookingSettingsSection({ profile }: { profile: UserProfile }) {
  const queryClient = useQueryClient();
  const prefs = profile.preferences as UserPreferences | undefined;
  const savedDefaults = prefs?.checklistDefaults ?? [];

  // ── General subsection state ──
  const [generalSaved, setGeneralSaved] = useState(false);

  const generalDefaults: BookingGeneralForm = {
    songRequestFormEnabled: profile.songRequestFormEnabled,
    defaultBookingStatus: prefs?.defaultBookingStatus ?? 'PROVISIONAL',
  };

  const { control: generalControl, handleSubmit: handleGeneralSubmit, reset: resetGeneral } =
    useForm<BookingGeneralForm>({
      resolver: zodResolver(bookingGeneralSchema),
      defaultValues: generalDefaults,
    });

  useEffect(() => { resetGeneral(generalDefaults); }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const generalMutation = useMutation({
    mutationFn: ({ songRequestFormEnabled, defaultBookingStatus }: BookingGeneralForm) =>
      apiPatch<UserProfile>('/me', {
        songRequestFormEnabled,
        preferences: { defaultBookingStatus },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      setGeneralSaved(true);
      setTimeout(() => setGeneralSaved(false), 3000);
    },
    onError: () => toast({ title: 'Failed to save booking settings', variant: 'destructive' }),
  });

  // ── Checklist subsection state ──
  const [checklistSaved, setChecklistSaved] = useState(false);

  // System item overrides: key → { enabled, dueDateRule }
  const initialOverrides: Record<string, { enabled: boolean; dueDateRule: DueDateRule | null }> = {};
  for (const group of CHECKLIST_STAGE_GROUPS) {
    for (const item of group.items) {
      const saved = savedDefaults.find((d) => d.key === item.key);
      initialOverrides[item.key] = {
        enabled: saved?.enabled !== false,
        dueDateRule: saved?.dueDateRule !== undefined ? saved.dueDateRule : item.defaultDueDateRule,
      };
    }
  }
  const [overrides, setOverrides] = useState(initialOverrides);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editBasis, setEditBasis] = useState<'bookingDate' | 'bookingCreation'>('bookingDate');
  const [editOffset, setEditOffset] = useState(0); // signed: negative = before

  // Custom items
  const initialCustom: ChecklistDefaultItem[] = savedDefaults.filter(
    (d) => !ALL_SYSTEM_KEYS.includes(d.key as string),
  );
  const [customItems, setCustomItems] = useState<ChecklistDefaultItem[]>(initialCustom);
  useEffect(() => {
    const prefs = profile.preferences as UserPreferences | undefined;
    const defaults = prefs?.checklistDefaults ?? [];
    setCustomItems(defaults.filter((d) => !ALL_SYSTEM_KEYS.includes(d.key as string)));
  }, [profile]);
  const [newItem, setNewItem] = useState<CustomItemForm>({
    label: '',
    completedBy: 'USER',
    requiredForStatus: 'NONE',
    dueDateBasis: 'bookingDate',
    dueDateOffset: '',
    hasDueDate: false,
  });

  // Custom item editing
  const [editingCustomIdx, setEditingCustomIdx] = useState<number | null>(null);
  const [editCustom, setEditCustom] = useState<CustomItemForm | null>(null);

  function startEditCustom(idx: number) {
    const item = customItems[idx];
    const days = item.dueDateRule?.offsetDays ?? 0;
    setEditingCustomIdx(idx);
    setEditCustom({
      label: item.label,
      completedBy: item.completedBy === 'BAND_MEMBER' ? 'USER' : item.completedBy,
      requiredForStatus: (item.requiredForStatus ?? 'NONE') as CustomItemForm['requiredForStatus'],
      hasDueDate: !!item.dueDateRule,
      dueDateBasis: item.dueDateRule?.basis ?? 'bookingDate',
      dueDateOffset: days.toString(),
    });
  }

  function saveEditCustom() {
    if (!editCustom || editingCustomIdx === null) return;
    const dueDateRule: DueDateRule | null =
      editCustom.hasDueDate && editCustom.dueDateOffset !== ''
        ? { basis: editCustom.dueDateBasis, offsetDays: Number(editCustom.dueDateOffset) }
        : null;
    setCustomItems((prev) =>
      prev.map((item, i) =>
        i === editingCustomIdx
          ? {
              ...item,
              label: editCustom.label.trim() || item.label,
              completedBy: editCustom.completedBy,
              requiredForStatus: editCustom.requiredForStatus === 'NONE'
                ? null
                : (editCustom.requiredForStatus as ChecklistDefaultItem['requiredForStatus']),
              dueDateRule,
            }
          : item,
      ),
    );
    setEditingCustomIdx(null);
    setEditCustom(null);
  }

  function toggleCustomEnabled(idx: number, value: boolean) {
    setCustomItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, enabled: value ? undefined : false } : item)),
    );
  }

  // Group custom items by stage for merged rendering
  const customByStage = new Map<string | null, Array<{ item: ChecklistDefaultItem; idx: number }>>();
  customItems.forEach((item, idx) => {
    const key = item.requiredForStatus ?? null;
    if (!customByStage.has(key)) customByStage.set(key, []);
    customByStage.get(key)!.push({ item, idx });
  });
  const nullStageCustom = customByStage.get(null) ?? [];

  // Watch songRequestFormEnabled from general form to lock music items
  const [songFormEnabled, setSongFormEnabled] = useState(profile.songRequestFormEnabled);
  useEffect(() => { setSongFormEnabled(profile.songRequestFormEnabled); }, [profile]);

  const checklistMutation = useMutation({
    mutationFn: () =>
      apiPatch<UserProfile>('/me/preferences/checklist-defaults', {
        systemItemOverrides: ALL_SYSTEM_KEYS.map((key) => ({
          key,
          enabled: overrides[key]?.enabled ?? true,
          dueDateRule: overrides[key]?.dueDateRule ?? null,
        })),
        customItems: customItems.map((item) => ({
          label: item.label,
          completedBy: item.completedBy,
          requiredForStatus: item.requiredForStatus ?? null,
          dueDateRule: item.dueDateRule ?? null,
          ...(item.enabled === false ? { enabled: false } : {}),
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      setChecklistSaved(true);
      setTimeout(() => setChecklistSaved(false), 3000);
    },
    onError: () => toast({ title: 'Failed to save checklist defaults', variant: 'destructive' }),
  });

  const startEdit = (key: string) => {
    const current = overrides[key]?.dueDateRule;
    const days = current?.offsetDays ?? 0;
    setEditBasis(current?.basis ?? 'bookingDate');
    setEditOffset(days);
    setEditingKey(key);
  };

  const saveEdit = (key: string, enabled: boolean) => {
    setOverrides((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        dueDateRule: enabled ? { basis: editBasis, offsetDays: editOffset } : null,
      },
    }));
    setEditingKey(null);
  };

  const toggleItemEnabled = (key: string, value: boolean) => {
    setOverrides((prev) => ({ ...prev, [key]: { ...prev[key], enabled: value } }));
  };

  const addCustomItem = () => {
    if (!newItem.label.trim()) return;
    const dueDateRule: DueDateRule | null =
      newItem.hasDueDate && newItem.dueDateOffset !== ''
        ? { basis: newItem.dueDateBasis, offsetDays: Number(newItem.dueDateOffset) }
        : null;
    setCustomItems((prev) => [
      ...prev,
      {
        key: null,
        label: newItem.label.trim(),
        completedBy: newItem.completedBy,
        dependsOn: [],
        autoCompleteRule: null,
        requiredForStatus: (newItem.requiredForStatus === 'NONE' ? null : newItem.requiredForStatus) as ChecklistDefaultItem['requiredForStatus'],
        dueDateRule,
      },
    ]);
    setNewItem({ label: '', completedBy: 'USER', requiredForStatus: 'NONE', dueDateBasis: 'bookingDate', dueDateOffset: '', hasDueDate: false });
  };

  return (
    <div className="space-y-10">
      <PageSection
        title="Booking settings"
        description="Control how new bookings are created and what appears on their checklists."
      />

      {/* ── General ── */}
      <div>
        <SubsectionHeader title="General" />
        <form onSubmit={handleGeneralSubmit((v) => { generalMutation.mutate(v); setSongFormEnabled(v.songRequestFormEnabled); })} className="space-y-5">
          <Controller
            name="songRequestFormEnabled"
            control={generalControl}
            render={({ field }) => (
              <label className="flex items-start gap-3 cursor-pointer">
                <Toggle checked={field.value} onChange={field.onChange} />
                <div className="-mt-0.5">
                  <p className="text-sm font-medium text-foreground">Song request form</p>
                  <p className="text-xs text-muted mt-0.5">
                    Allow clients to submit music preferences via their portal
                  </p>
                </div>
              </label>
            )}
          />

          <FormField label="Default booking status">
            <Controller
              name="defaultBookingStatus"
              control={generalControl}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ENQUIRY">Enquiry</SelectItem>
                    <SelectItem value="PROVISIONAL">Provisional</SelectItem>
                    <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted mt-1">Pre-selected status when creating a new booking</p>
          </FormField>

          <SaveBar isPending={generalMutation.isPending} saved={generalSaved} isError={generalMutation.isError} />
        </form>
      </div>

      <div className="border-t border-border" />

      {/* ── Checklist ── */}
      <div>
        <SubsectionHeader
          title="Checklist"
          description="Customise which items appear on new bookings and set their due dates."
        />

        <div className="space-y-4 mb-6">
          {/* Enquiry start marker */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] font-medium text-muted uppercase tracking-wider px-2">Enquiry</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Null-stage custom items at top (no stage requirement) */}
          {nullStageCustom.length > 0 && (
            <div className="space-y-2">
              {nullStageCustom.map(({ item, idx }) =>
                editingCustomIdx === idx ? (
                  <div key={`edit-${idx}`} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        value={editCustom!.label}
                        onChange={(e) => setEditCustom((p) => p && { ...p, label: e.target.value })}
                        placeholder="Item label"
                        className="text-sm flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => { setCustomItems((prev) => prev.filter((_, i) => i !== idx)); setEditingCustomIdx(null); setEditCustom(null); }}
                        className="text-muted hover:text-status-cancelled transition-colors flex-shrink-0"
                        aria-label="Delete item"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Select value={editCustom!.completedBy} onValueChange={(v) => setEditCustom((p) => p && { ...p, completedBy: v as 'USER' | 'CUSTOMER' })}>
                        <SelectTrigger className="w-32 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USER">By me</SelectItem>
                          <SelectItem value="CUSTOMER">By client</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={editCustom!.requiredForStatus} onValueChange={(v) => setEditCustom((p) => p && { ...p, requiredForStatus: v as CustomItemForm['requiredForStatus'] })}>
                        <SelectTrigger className="w-48 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NONE">Not required for a stage</SelectItem>
                          <SelectItem value="CONFIRMED">Required for Confirmed</SelectItem>
                          <SelectItem value="READY">Required for Ready</SelectItem>
                          <SelectItem value="COMPLETE">Required for Complete</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={editCustom!.hasDueDate} onChange={(e) => setEditCustom((p) => p && { ...p, hasDueDate: e.target.checked })} className="rounded border-border" />
                        <span className="text-xs text-foreground">Due date</span>
                      </label>
                      {editCustom!.hasDueDate && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <input type="number" min={0} value={Math.abs(Number(editCustom!.dueDateOffset))} onChange={(e) => setEditCustom((p) => { if (!p) return p; const sign = Number(p.dueDateOffset) < 0 ? -1 : 1; return { ...p, dueDateOffset: (sign * Number(e.target.value)).toString() }; })} placeholder="14" className="w-14 text-xs border border-border rounded px-2 py-1 bg-background" />
                          <span className="text-xs text-muted">days</span>
                          <select value={Number(editCustom!.dueDateOffset) < 0 ? 'before' : 'after'} onChange={(e) => setEditCustom((p) => { if (!p) return p; const abs = Math.abs(Number(p.dueDateOffset)); return { ...p, dueDateOffset: (e.target.value === 'before' ? -abs : abs).toString() }; })} className="text-xs border border-border rounded px-2 py-1 bg-background">
                            <option value="before">before</option>
                            <option value="after">after</option>
                          </select>
                          <select value={editCustom!.dueDateBasis} onChange={(e) => setEditCustom((p) => p && { ...p, dueDateBasis: e.target.value as 'bookingDate' | 'bookingCreation' })} className="text-xs border border-border rounded px-2 py-1 bg-background">
                            <option value="bookingDate">booking date</option>
                            <option value="bookingCreation">booking creation</option>
                          </select>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" className="text-xs h-7" onClick={saveEditCustom} disabled={!editCustom!.label.trim()}>Save</Button>
                      <Button type="button" size="sm" variant="ghost" className="text-xs h-7" onClick={() => { setEditingCustomIdx(null); setEditCustom(null); }}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div key={`custom-${idx}`} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <Toggle checked={item.enabled !== false} onChange={(v) => toggleCustomEnabled(idx, v)} />
                    <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                      <span className={cn('text-sm', item.enabled !== false ? 'text-foreground' : 'text-muted')}>{item.label}</span>
                      <span className="text-xs text-muted border border-border rounded px-1 py-0.5 leading-none">{item.completedBy === 'CUSTOMER' ? 'Client' : 'Me'}</span>
                      <span className="text-xs text-primary/60 border border-primary/30 rounded px-1 py-0.5 leading-none">Custom</span>
                    </div>
                    <div className="w-full sm:w-auto pl-12 sm:pl-0">
                      <button type="button" onClick={() => startEditCustom(idx)} className="flex items-center gap-1 text-xs text-primary hover:underline" aria-label={`Edit ${item.label}`}>
                        {formatDueDateRule(item.dueDateRule)}<Pencil size={11} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {/* Stage groups: items first, then stage milestone divider below */}
          {CHECKLIST_STAGE_GROUPS.map(({ stage, label: stageLabel, items }) => {
            const stageCustom = customByStage.get(stage) ?? [];
            return (
              <div key={stage}>
                <div className="space-y-2 mb-3">
                  {items.map((item) => {
                    const isGated = item.musicFormGated && !songFormEnabled;
                    const itemEnabled = overrides[item.key]?.enabled ?? true;
                    const effective = isGated ? false : itemEnabled;
                    return (
                      <div key={item.key}>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                          <Toggle checked={effective} onChange={(v) => !isGated && toggleItemEnabled(item.key, v)} disabled={isGated} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={cn('text-sm', effective ? 'text-foreground' : 'text-muted')}>{item.label}</span>
                              <span className="text-xs text-muted border border-border rounded px-1 py-0.5 leading-none">{item.completedBy === 'CUSTOMER' ? 'Client' : 'Me'}</span>
                            </div>
                            {isGated && <p className="text-xs text-muted mt-0.5">Enable song request form to include this item</p>}
                          </div>
                          <div className="w-full sm:w-auto pl-12 sm:pl-0">
                            {editingKey === item.key ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                <input type="number" min={0} value={Math.abs(editOffset)} onChange={(e) => setEditOffset((editOffset < 0 ? -1 : 1) * Number(e.target.value))} className="w-14 text-xs border border-border rounded px-2 py-1 bg-background" placeholder="14" />
                                <span className="text-xs text-muted">days</span>
                                <select value={editOffset < 0 ? 'before' : 'after'} onChange={(e) => setEditOffset(e.target.value === 'before' ? -Math.abs(editOffset) : Math.abs(editOffset))} className="text-xs border border-border rounded px-2 py-1 bg-background">
                                  <option value="before">before</option>
                                  <option value="after">after</option>
                                </select>
                                <select value={editBasis} onChange={(e) => setEditBasis(e.target.value as 'bookingDate' | 'bookingCreation')} className="text-xs border border-border rounded px-2 py-1 bg-background">
                                  <option value="bookingDate">booking date</option>
                                  <option value="bookingCreation">booking creation</option>
                                </select>
                                <Button type="button" size="sm" variant="outline" className="text-xs h-7" onClick={() => saveEdit(item.key, true)}>Save</Button>
                                <Button type="button" size="sm" variant="ghost" className="text-xs h-7" onClick={() => saveEdit(item.key, false)}>No date</Button>
                                <Button type="button" size="sm" variant="ghost" className="text-xs h-7" onClick={() => setEditingKey(null)}>Cancel</Button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => startEdit(item.key)} className="flex items-center gap-1 text-xs text-primary hover:underline">
                                {formatDueDateRule(overrides[item.key]?.dueDateRule ?? null)}<Pencil size={11} aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {stageCustom.map(({ item, idx }) =>
                    editingCustomIdx === idx ? (
                      <div key={`edit-${idx}`} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <Input type="text" value={editCustom!.label} onChange={(e) => setEditCustom((p) => p && { ...p, label: e.target.value })} placeholder="Item label" className="text-sm flex-1" />
                          <button type="button" onClick={() => { setCustomItems((prev) => prev.filter((_, i) => i !== idx)); setEditingCustomIdx(null); setEditCustom(null); }} className="text-muted hover:text-status-cancelled transition-colors flex-shrink-0" aria-label="Delete item">
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Select value={editCustom!.completedBy} onValueChange={(v) => setEditCustom((p) => p && { ...p, completedBy: v as 'USER' | 'CUSTOMER' })}>
                            <SelectTrigger className="w-32 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="USER">By me</SelectItem>
                              <SelectItem value="CUSTOMER">By client</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select value={editCustom!.requiredForStatus} onValueChange={(v) => setEditCustom((p) => p && { ...p, requiredForStatus: v as CustomItemForm['requiredForStatus'] })}>
                            <SelectTrigger className="w-48 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="NONE">Not required for a stage</SelectItem>
                              <SelectItem value="CONFIRMED">Required for Confirmed</SelectItem>
                              <SelectItem value="READY">Required for Ready</SelectItem>
                              <SelectItem value="COMPLETE">Required for Complete</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={editCustom!.hasDueDate} onChange={(e) => setEditCustom((p) => p && { ...p, hasDueDate: e.target.checked })} className="rounded border-border" />
                            <span className="text-xs text-foreground">Due date</span>
                          </label>
                          {editCustom!.hasDueDate && (
                            <div className="flex items-center gap-2 flex-wrap">
                              <input type="number" min={0} value={Math.abs(Number(editCustom!.dueDateOffset))} onChange={(e) => setEditCustom((p) => { if (!p) return p; const sign = Number(p.dueDateOffset) < 0 ? -1 : 1; return { ...p, dueDateOffset: (sign * Number(e.target.value)).toString() }; })} placeholder="14" className="w-14 text-xs border border-border rounded px-2 py-1 bg-background" />
                              <span className="text-xs text-muted">days</span>
                              <select value={Number(editCustom!.dueDateOffset) < 0 ? 'before' : 'after'} onChange={(e) => setEditCustom((p) => { if (!p) return p; const abs = Math.abs(Number(p.dueDateOffset)); return { ...p, dueDateOffset: (e.target.value === 'before' ? -abs : abs).toString() }; })} className="text-xs border border-border rounded px-2 py-1 bg-background">
                                <option value="before">before</option>
                                <option value="after">after</option>
                              </select>
                              <select value={editCustom!.dueDateBasis} onChange={(e) => setEditCustom((p) => p && { ...p, dueDateBasis: e.target.value as 'bookingDate' | 'bookingCreation' })} className="text-xs border border-border rounded px-2 py-1 bg-background">
                                <option value="bookingDate">booking date</option>
                                <option value="bookingCreation">booking creation</option>
                              </select>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" size="sm" variant="outline" className="text-xs h-7" onClick={saveEditCustom} disabled={!editCustom!.label.trim()}>Save</Button>
                          <Button type="button" size="sm" variant="ghost" className="text-xs h-7" onClick={() => { setEditingCustomIdx(null); setEditCustom(null); }}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div key={`custom-${idx}`} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <Toggle checked={item.enabled !== false} onChange={(v) => toggleCustomEnabled(idx, v)} />
                        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                          <span className={cn('text-sm', item.enabled !== false ? 'text-foreground' : 'text-muted')}>{item.label}</span>
                          <span className="text-xs text-muted border border-border rounded px-1 py-0.5 leading-none">{item.completedBy === 'CUSTOMER' ? 'Client' : 'Me'}</span>
                          <span className="text-xs text-primary/60 border border-primary/30 rounded px-1 py-0.5 leading-none">Custom</span>
                        </div>
                        <div className="w-full sm:w-auto pl-12 sm:pl-0">
                          <button type="button" onClick={() => startEditCustom(idx)} className="flex items-center gap-1 text-xs text-primary hover:underline" aria-label={`Edit ${item.label}`}>
                            {formatDueDateRule(item.dueDateRule)}<Pencil size={11} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>
                {/* Stage milestone divider — below items; omitted for Complete (terminal stage) */}
                {stage !== 'COMPLETE' && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[10px] font-medium text-muted uppercase tracking-wider px-2">{stageLabel}</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Card title="Add custom item" className="space-y-3 mb-6">
          <div className="space-y-2">
            <Input
              placeholder="Item label"
              value={newItem.label}
              onChange={(e) => setNewItem((p) => ({ ...p, label: e.target.value }))}
            />
            <div className="flex gap-2 flex-wrap">
              <Select value={newItem.completedBy} onValueChange={(v) => setNewItem((p) => ({ ...p, completedBy: v as 'USER' | 'CUSTOMER' }))}>
                <SelectTrigger className="w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">By me</SelectItem>
                  <SelectItem value="CUSTOMER">By client</SelectItem>
                </SelectContent>
              </Select>
              <Select value={newItem.requiredForStatus} onValueChange={(v) => setNewItem((p) => ({ ...p, requiredForStatus: v as CustomItemForm['requiredForStatus'] }))}>
                <SelectTrigger className="w-48 text-xs"><SelectValue placeholder="Stage requirement" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Not required for a stage</SelectItem>
                  <SelectItem value="CONFIRMED">Required for Confirmed</SelectItem>
                  <SelectItem value="READY">Required for Ready</SelectItem>
                  <SelectItem value="COMPLETE">Required for Complete</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newItem.hasDueDate}
                  onChange={(e) => setNewItem((p) => ({ ...p, hasDueDate: e.target.checked }))}
                  className="rounded border-border"
                />
                <span className="text-xs text-foreground">Set due date</span>
              </label>
              {newItem.hasDueDate && (
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="number"
                    min={0}
                    value={Math.abs(Number(newItem.dueDateOffset))}
                    onChange={(e) => setNewItem((p) => { const sign = Number(p.dueDateOffset) < 0 ? -1 : 1; return { ...p, dueDateOffset: (sign * Number(e.target.value)).toString() }; })}
                    placeholder="14"
                    className="w-14 text-xs border border-border rounded px-2 py-1 bg-background"
                  />
                  <span className="text-xs text-muted">days</span>
                  <select
                    value={Number(newItem.dueDateOffset) < 0 ? 'before' : 'after'}
                    onChange={(e) => setNewItem((p) => { const abs = Math.abs(Number(p.dueDateOffset)); return { ...p, dueDateOffset: (e.target.value === 'before' ? -abs : abs).toString() }; })}
                    className="text-xs border border-border rounded px-2 py-1 bg-background"
                  >
                    <option value="before">before</option>
                    <option value="after">after</option>
                  </select>
                  <select
                    value={newItem.dueDateBasis}
                    onChange={(e) => setNewItem((p) => ({ ...p, dueDateBasis: e.target.value as 'bookingDate' | 'bookingCreation' }))}
                    className="text-xs border border-border rounded px-2 py-1 bg-background"
                  >
                    <option value="bookingDate">booking date</option>
                    <option value="bookingCreation">booking creation</option>
                  </select>
                </div>
              )}
            </div>
            <Button type="button" size="sm" variant="outline" onClick={addCustomItem} disabled={!newItem.label.trim()}>
              <Plus size={14} className="mr-1" />
              Add
            </Button>
          </div>
        </Card>

        <SaveBar
          isPending={checklistMutation.isPending}
          saved={checklistSaved}
          isError={checklistMutation.isError}
          onSave={() => checklistMutation.mutate()}
        />
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SettingsSkeleton() {
  return (
    <div className="px-6 py-8 max-w-3xl mx-auto space-y-10 animate-pulse">
      <div className="h-7 w-24 bg-border rounded" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-4">
          <div className="h-4 w-36 bg-border rounded" />
          <div className="h-10 w-full bg-border rounded" />
          <div className="h-10 w-full bg-border rounded" />
          <div className="h-9 w-28 bg-border rounded" />
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { isLoaded } = useAuth();

  const { data: publicProfile } = useQuery({
    queryKey: ['publicProfile'],
    queryFn: () => apiGet<PublicProfile>('/me/public'),
    enabled: isLoaded,
  });

  const { data: userProfile } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<UserProfile>('/me'),
    enabled: isLoaded,
  });

  if (!publicProfile || !userProfile) return <SettingsSkeleton />;

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto">
      <h1 className="font-display text-2xl font-semibold text-foreground mb-10">Settings</h1>
      <div className="space-y-12">
        <PublicProfileSection profile={publicProfile} />
        <div className="border-t border-border" />
        <PortalSection />
        <div className="border-t border-border" />
        <BusinessDetailsSection profile={userProfile} />
        <div className="border-t border-border" />
        <InvoiceSettingsSection profile={userProfile} />
        <div className="border-t border-border" />
        <NotificationsSection profile={userProfile} />
        <div className="border-t border-border" />
        <BookingSettingsSection profile={userProfile} />
      </div>
    </div>
  );
}
