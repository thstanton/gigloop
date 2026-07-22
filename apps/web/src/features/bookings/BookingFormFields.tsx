import { Controller, useWatch } from 'react-hook-form';
import type { Control, FieldErrors } from 'react-hook-form';
import { z } from 'zod';
import { Plus } from 'lucide-react';
import { GhostButton } from '@/components/common/GhostButton';
import { StatusCoachingField } from './StatusCoachingField';
import { RoleField, type RoleSelection } from './PeopleFields';
import { VenueFields, type VenueSelection } from './VenueFields';
import { OverviewFields, type OverviewFieldsValue } from './OverviewFields';
import { PackagePicker } from './PackagePicker';
import { MusicFormToggle } from './MusicFields';
import { NotesField } from './NotesFields';
import type { BookingSeries, PackageTemplate } from '@/types/api';

// ─── Schema ───────────────────────────────────────────────────────────────────

export const bookingFormSchema = z.object({
  // Overview bubbles the booking's identity (event type, date, fee, title, series) from the
  // shared atom core (ADR-0053). Series flows to the atomic POST via seriesId / newSeries.
  overview: z
    .custom<OverviewFieldsValue>()
    .refine((o) => !!o && o.date.trim().length > 0, { message: 'Date is required' }),
  status: z.enum(['ENQUIRY', 'PROVISIONAL', 'CONFIRMED', 'READY', 'COMPLETE', 'CANCELLED'] as const),
  notes: z.string(),
  // People + Venue bubble an existing-or-new selection from the shared atom cores (ADR-0053);
  // the create shell resolves a `new` selection to an id (eager POST /contacts) at submit.
  customer: z
    .custom<RoleSelection>()
    .refine(
      (s) => (s && s.kind === 'new' ? s.contact.name.trim().length > 0 : !!s && s.contactId != null),
      { message: 'Customer is required' },
    ),
  bookingAgent: z.custom<RoleSelection>(),
  venue: z.custom<VenueSelection>(),
  packageTemplateIds: z.array(z.string()),
  enableMusicForm: z.boolean(),
});

export type BookingFormValues = z.infer<typeof bookingFormSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  control: Control<BookingFormValues>;
  errors: FieldErrors<BookingFormValues>;
  songRequestFormEnabled?: boolean;
  formats?: PackageTemplate[];
  /** Distinguishes "still fetching" from "library is genuinely empty" — without it the section
   *  flashes its empty state on every page load. */
  formatsLoading?: boolean;
  series?: BookingSeries[];
  /**
   * Opens the shell's package-template drawer (#755). Omitted → no create affordance, so this
   * component stays presentational: it owns no mutation and no fetch, mirroring PackagePicker's
   * contract (ADR-0053).
   */
  onCreateTemplate?: () => void;
}

export function BookingFormFields({
  control,
  errors,
  songRequestFormEnabled,
  formats,
  formatsLoading,
  series,
  onCreateTemplate,
}: Props) {
  // The package picker groups templates by the live event type (matching leads), so it reacts as
  // the musician changes it in the Overview section above.
  const eventType = useWatch({ control, name: 'overview.eventType' });

  return (
    <div className="space-y-6">
      {/* Overview — booking identity (event type, date, fee, title, series) from the shared
          Overview atom core (ADR-0053). Section chrome mirrors the Builder's BuilderSection. */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-foreground">Overview</h2>
        <div className="rounded-lg border border-border bg-background p-4">
          <Controller
            name="overview"
            control={control}
            render={({ field }) => (
              <OverviewFields
                value={field.value}
                onChange={field.onChange}
                series={(series ?? []).map((s) => ({ id: s.id, label: s.label }))}
                dateError={errors.overview?.message}
              />
            )}
          />
        </div>
      </section>

      {/* Starting status — stays a standalone, create-shell-owned control (not an Overview
          field); the coaching control teaches the lifecycle at the point of use (slice #545). */}
      <Controller
        name="status"
        control={control}
        render={({ field }) => (
          <StatusCoachingField value={field.value} onChange={field.onChange} />
        )}
      />

      {/* People — consolidated customer + booking agent, from the shared People atom core
          (ADR-0053). Section chrome (header + bordered container) mirrors the Builder's
          BuilderSection so the two surfaces look identical. Create-mode regime: each role
          bubbles its existing-or-new selection up; the shell resolves a `new` selection to an
          id at submit. */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-foreground">People</h2>
        <div className="rounded-lg border border-border bg-background p-4 space-y-4">
          <Controller
            name="customer"
            control={control}
            render={({ field }) => (
              <RoleField
                label="Customer"
                preferredRole="CUSTOMER"
                required
                variant="customer"
                initialContactId={field.value.kind === 'existing' ? field.value.contactId : null}
                initialMode={
                  field.value.kind === 'existing' && field.value.contactId ? 'existing' : 'new'
                }
                error={errors.customer?.message}
                onChange={field.onChange}
              />
            )}
          />

          <Controller
            name="bookingAgent"
            control={control}
            render={({ field }) => (
              <RoleField
                label="Booking agent"
                preferredRole="BOOKING_AGENT"
                required={false}
                variant="agent"
                initialContactId={field.value.kind === 'existing' ? field.value.contactId : null}
                onChange={field.onChange}
              />
            )}
          />
        </div>
      </section>

      {/* Venue — its own section, same Builder chrome. VenueFields renders its own
          "Venue (optional)" sub-header inside the container, mirroring the Builder. */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-foreground">Venue</h2>
        <div className="rounded-lg border border-border bg-background p-4">
          <Controller
            name="venue"
            control={control}
            render={({ field }) => (
              <VenueFields
                initialVenueId={field.value.kind === 'existing' ? field.value.venueId : null}
                onChange={field.onChange}
              />
            )}
          />
        </div>
      </section>

      {/* Packages — shared template picker (ADR-0053 / #546), same component the Builder uses.
          Ungated from the music-form flag (packages are performance structure, independent of
          the music form); the music-form contribution in previews is what `showMusic` gates.
          Also ungated from the library being non-empty (#755): since ADR-0046's 2026-07-07
          amendment a musician's library legitimately starts empty, and hiding the section there
          hid the only route to package templates from this flow. PackagePicker already renders
          its own "no templates yet" line, so the old length check was redundant.
          Creating a template is the shell's job, not the picker's — the picker owns no mutation
          and is shared with the Builder (ADR-0053), so the affordance is a callback out. */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-foreground">Package Templates</h2>
        <div className="rounded-lg border border-border bg-background p-4">
          <Controller
            name="packageTemplateIds"
            control={control}
            render={({ field }) => (
              <PackagePicker
                templates={formats ?? []}
                templatesLoading={formatsLoading}
                eventType={eventType}
                selectedIds={field.value}
                onToggle={(id) =>
                  field.onChange(
                    field.value.includes(id)
                      ? field.value.filter((x) => x !== id)
                      : [...field.value, id],
                  )
                }
                showMusic={!!songRequestFormEnabled}
              />
            )}
          />
          {onCreateTemplate && (
            <div className="mt-3">
              <GhostButton
                variant="primary"
                icon={<Plus size={14} aria-hidden="true" />}
                onClick={onCreateTemplate}
              >
                New package template
              </GhostButton>
            </div>
          )}
        </div>
      </section>

      {/* Music — on/off only in create (Story 39 lean variant): the shared MusicFormToggle core,
          the same on/off block the Builder's Music atom renders (ADR-0053 / #547). Genre and
          special-request editing stays post-commit. Presence of a config row is the on/off truth
          (ADR-0046); this boolean flows into the atomic POST's enableMusicForm unchanged, which
          creates the row on booking creation, seeded from the chosen packages. Section chrome
          mirrors the Builder's BuilderSection (item 7). */}
      {songRequestFormEnabled && (
        <section>
          <h2 className="mb-3 text-base font-semibold text-foreground">Music</h2>
          <div className="rounded-lg border border-border bg-background p-4">
            <Controller
              name="enableMusicForm"
              control={control}
              render={({ field }) => (
                <MusicFormToggle checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>
        </section>
      )}

      {/* Notes — the shared Notes core (ADR-0053 / #548), the same editor the Builder's Notes
          section uses. Section chrome mirrors the Builder's BuilderSection (item 7); the inner
          "Notes" header + Saving/Saved status are InlineNotes' self-saving chrome, which the lean
          create form omits — the value bubbles to the atomic POST's notes unchanged. */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-foreground">Notes</h2>
        <div className="rounded-lg border border-border bg-background p-4">
          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <NotesField value={field.value} onChange={field.onChange} />
            )}
          />
        </div>
      </section>
    </div>
  );
}
