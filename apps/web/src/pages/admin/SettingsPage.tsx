import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiGet, apiPatch } from '@/lib/api';
import type { PublicProfile, UserProfile, UpdatePublicProfileInput, UpdateUserProfileInput, PortalTheme } from '@/types/api';
import { cn } from '@/lib/utils';

// ─── Schemas ─────────────────────────────────────────────────────────────────

const publicSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  displayName: z.string(),
  email: z.string().email('Invalid email').or(z.literal('')),
  phone: z.string(),
  bio: z.string(),
  website: z.string().url('Invalid URL').or(z.literal('')),
  brandColour: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a 6-digit hex colour'),
  portalTheme: z.enum(['LIGHT_MODERN', 'LIGHT_ROMANTIC', 'BOLD_MODERN', 'BOLD_ROMANTIC']),
});

type PublicForm = z.infer<typeof publicSchema>;

const businessSchema = z.object({
  address: z.string(),
  bankDetails: z.string(),
  vatNumber: z.string(),
  defaultPaymentTermsDays: z.number().int().min(0, 'Must be 0 or more'),
  depositTrackingMode: z.enum(['INVOICE', 'MANUAL']),
});

type BusinessForm = z.infer<typeof businessSchema>;

const notificationsSchema = z.object({
  digestEmailEnabled: z.boolean(),
  songRequestFormEnabled: z.boolean(),
  quoteReminderDays: z.number().int().min(1).nullable(),
  contractReminderDays: z.number().int().min(1).nullable(),
  depositInvoiceReminderDays: z.number().int().min(1).nullable(),
  balanceInvoiceReminderDays: z.number().int().min(1).nullable(),
  musicFormReminderDays: z.number().int().min(1).nullable(),
  thankYouReminderDays: z.number().int().min(1).nullable(),
});

type NotificationsForm = z.infer<typeof notificationsSchema>;

// ─── Shared helpers ───────────────────────────────────────────────────────────

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

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
    </div>
  );
}

function SaveBar({
  isPending,
  saved,
  isError,
}: {
  isPending: boolean;
  saved: boolean;
  isError: boolean;
}) {
  return (
    <div className="flex items-center gap-4 pt-2">
      <Button type="submit" disabled={isPending}>
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
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex w-9 h-5 rounded-full transition-colors duration-150 flex-shrink-0',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        checked ? 'bg-primary' : 'bg-border',
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
    brandColour: profile.brandColour ?? '#000000',
    portalTheme: (profile.portalTheme ?? 'LIGHT_MODERN') as PublicForm['portalTheme'],
  };

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
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

  function onSubmit(values: PublicForm) {
    mutation.mutate({
      businessName: values.businessName,
      displayName: values.displayName || null,
      email: values.email || null,
      phone: values.phone || null,
      bio: values.bio || null,
      website: values.website || null,
      brandColour: values.brandColour,
      portalTheme: values.portalTheme as PortalTheme,
    });
  }

  const brandColour = watch('brandColour');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <SectionHeader
        title="Public profile"
        description="Shown on your client portal and in emails."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Business name" required error={errors.businessName?.message}>
          <Input {...register('businessName')} />
        </Field>
        <Field label="Display name" error={errors.displayName?.message}>
          <Input {...register('displayName')} placeholder="e.g. John Smith" />
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

      <Field label="Bio" error={errors.bio?.message}>
        <Textarea
          {...register('bio')}
          rows={3}
          placeholder="A short introduction for your clients"
        />
      </Field>

      <Field label="Website" error={errors.website?.message}>
        <Input type="url" {...register('website')} placeholder="https://" />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Brand colour" error={errors.brandColour?.message}>
          <div className="flex items-center gap-2">
            <Controller
              name="brandColour"
              control={control}
              render={({ field }) => (
                <input
                  type="color"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  className="h-9 w-10 rounded border border-border cursor-pointer p-0.5 bg-background flex-shrink-0"
                  style={{ accentColor: brandColour }}
                />
              )}
            />
            <Input {...register('brandColour')} className="font-mono text-sm" />
          </div>
        </Field>

        <Field label="Portal theme" error={errors.portalTheme?.message}>
          <Controller
            name="portalTheme"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LIGHT_MODERN">Light Modern</SelectItem>
                  <SelectItem value="LIGHT_ROMANTIC">Light Romantic</SelectItem>
                  <SelectItem value="BOLD_MODERN">Bold Modern</SelectItem>
                  <SelectItem value="BOLD_ROMANTIC">Bold Romantic</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </div>

      <SaveBar isPending={mutation.isPending} saved={saved} isError={mutation.isError} />
    </form>
  );
}

// ─── Business details section ─────────────────────────────────────────────────

function BusinessDetailsSection({ profile }: { profile: UserProfile }) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);

  const defaults = {
    address: profile.address ?? '',
    bankDetails: profile.bankDetails ?? '',
    vatNumber: profile.vatNumber ?? '',
    defaultPaymentTermsDays: profile.defaultPaymentTermsDays,
    depositTrackingMode: (profile.depositTrackingMode ?? 'INVOICE') as 'INVOICE' | 'MANUAL',
  };

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BusinessForm>({ resolver: zodResolver(businessSchema), defaultValues: defaults });

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
      address: values.address || undefined,
      bankDetails: values.bankDetails || null,
      vatNumber: values.vatNumber || undefined,
      defaultPaymentTermsDays: values.defaultPaymentTermsDays,
      depositTrackingMode: values.depositTrackingMode,
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <SectionHeader
        title="Business details"
        description="Used on invoices and other client-facing documents."
      />

      <Field label="Address" error={errors.address?.message}>
        <Textarea {...register('address')} rows={3} placeholder="Your business address" />
      </Field>

      <Field label="Bank details" error={errors.bankDetails?.message}>
        <Textarea
          {...register('bankDetails')}
          rows={3}
          placeholder="Sort code, account number, bank name"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="VAT number" error={errors.vatNumber?.message}>
          <Input {...register('vatNumber')} placeholder="GB123456789" />
        </Field>
        <Field label="Default payment terms" error={errors.defaultPaymentTermsDays?.message}>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              {...register('defaultPaymentTermsDays', { valueAsNumber: true })}
              className="w-20"
            />
            <span className="text-sm text-muted">days</span>
          </div>
        </Field>
      </div>

      <Field label="Deposit tracking" error={errors.depositTrackingMode?.message}>
        <Controller
          name="depositTrackingMode"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INVOICE">
                  Automatic — when deposit invoice is marked paid
                </SelectItem>
                <SelectItem value="MANUAL">Manual</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </Field>

      <SaveBar isPending={mutation.isPending} saved={saved} isError={mutation.isError} />
    </form>
  );
}

// ─── Notifications section ────────────────────────────────────────────────────

type ReminderKey =
  | 'quoteReminderDays'
  | 'contractReminderDays'
  | 'depositInvoiceReminderDays'
  | 'balanceInvoiceReminderDays'
  | 'musicFormReminderDays'
  | 'thankYouReminderDays';

const REMINDERS: { name: ReminderKey; label: string; afterEvent?: true }[] = [
  { name: 'quoteReminderDays',          label: 'Quote email' },
  { name: 'contractReminderDays',       label: 'Contract' },
  { name: 'depositInvoiceReminderDays', label: 'Deposit invoice' },
  { name: 'balanceInvoiceReminderDays', label: 'Balance invoice' },
  { name: 'musicFormReminderDays',      label: 'Music preference form' },
  { name: 'thankYouReminderDays',       label: 'Thank you email', afterEvent: true },
];

function NotificationsSection({ profile }: { profile: UserProfile }) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);

  const defaults: NotificationsForm = {
    digestEmailEnabled: profile.digestEmailEnabled,
    songRequestFormEnabled: profile.songRequestFormEnabled,
    quoteReminderDays: profile.quoteReminderDays,
    contractReminderDays: profile.contractReminderDays,
    depositInvoiceReminderDays: profile.depositInvoiceReminderDays,
    balanceInvoiceReminderDays: profile.balanceInvoiceReminderDays,
    musicFormReminderDays: profile.musicFormReminderDays,
    thankYouReminderDays: profile.thankYouReminderDays,
  };

  const { control, handleSubmit, reset } = useForm<NotificationsForm>({
    resolver: zodResolver(notificationsSchema),
    defaultValues: defaults,
  });

  useEffect(() => { reset(defaults); }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: (data: UpdateUserProfileInput) => apiPatch<UserProfile>('/me', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
      <SectionHeader
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
        <Controller
          name="songRequestFormEnabled"
          control={control}
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
      </div>

      <div>
        <p className="text-sm font-medium text-foreground">Email reminders</p>
        <p className="text-xs text-muted mt-0.5 mb-4">
          Days before the event each email is sent. Leave blank to disable.
        </p>
        <div className="space-y-4">
          {REMINDERS.map(({ name, label, afterEvent }) => (
            <Controller
              key={name}
              name={name}
              control={control}
              render={({ field }) => (
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
                  <span className="text-sm text-foreground sm:w-44 sm:flex-shrink-0">{label}</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      placeholder="Off"
                      value={field.value ?? ''}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === '' ? null : parseInt(e.target.value, 10),
                        )
                      }
                      className="w-20"
                    />
                    <span className="text-sm text-muted whitespace-nowrap">
                      days {afterEvent ? 'after' : 'before'} event
                    </span>
                  </div>
                </div>
              )}
            />
          ))}
        </div>
      </div>

      <SaveBar isPending={mutation.isPending} saved={saved} isError={mutation.isError} />
    </form>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SettingsSkeleton() {
  return (
    <div className="px-6 py-8 max-w-2xl space-y-10 animate-pulse">
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
    <div className="px-6 py-8 max-w-2xl">
      <h1 className="text-2xl font-semibold text-foreground mb-10">Settings</h1>
      <div className="space-y-12">
        <PublicProfileSection profile={publicProfile} />
        <div className="border-t border-border" />
        <BusinessDetailsSection profile={userProfile} />
        <div className="border-t border-border" />
        <NotificationsSection profile={userProfile} />
      </div>
    </div>
  );
}
