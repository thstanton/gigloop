import { Button } from '@/components/ui/button';
import { BuilderSection } from '@/features/bookings/BuilderSection';
import { PackagePicker } from '@/features/bookings/PackagePicker';
import { pluralPackages } from '@/features/bookings/builderHelpers';
import type { BookingDetail, PackageTemplate } from '@/types/api';
import type { useBookingBuilderMutations } from '@/features/bookings/useBookingBuilderMutations';

export function TemplatesSection({
  booking,
  templates,
  templatesLoading,
  mutations,
  refCallback,
}: {
  booking: BookingDetail;
  templates: PackageTemplate[];
  templatesLoading: boolean;
  mutations: ReturnType<typeof useBookingBuilderMutations>;
  refCallback?: React.RefCallback<HTMLElement>;
}) {
  const {
    pendingSuggestion, setPendingSuggestion, acceptSuggestion,
    stagedTemplateIds, setStagedTemplateIds, applyStagedTemplates,
  } = mutations;
  return (
    <BuilderSection id="templates" title="Package Templates" refCallback={refCallback}>
      {booking.packages.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {booking.packages.map((pkg) => (
            <span
              key={pkg.id}
              className="inline-flex items-center rounded-full bg-secondary border border-border px-3 py-1 text-sm"
            >
              {pkg.label}
            </span>
          ))}
        </div>
      )}
      {pendingSuggestion && (
        <div className="mb-4 rounded border border-border bg-primary/5 p-3 space-y-2">
          <p className="text-sm">
            This package suggests{' '}
            {pendingSuggestion.keyMoments.length > 0 && (
              <span className="font-medium">{pendingSuggestion.keyMoments.length} special request{pendingSuggestion.keyMoments.length === 1 ? '' : 's'}</span>
            )}
            {pendingSuggestion.keyMoments.length > 0 && pendingSuggestion.genres.length > 0 && ' and '}
            {pendingSuggestion.genres.length > 0 && (
              <span className="font-medium">{pendingSuggestion.genres.length} genre{pendingSuggestion.genres.length === 1 ? '' : 's'}</span>
            )}{' '}
            for the music form.
          </p>
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={() => acceptSuggestion.mutate(pendingSuggestion)} disabled={acceptSuggestion.isPending}>
              {acceptSuggestion.isPending ? 'Adding…' : 'Add to music form'}
            </Button>
            <button
              type="button"
              onClick={() => setPendingSuggestion(null)}
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              Not now
            </button>
          </div>
        </div>
      )}
      <PackagePicker
        templates={templates}
        templatesLoading={templatesLoading}
        eventType={booking.eventType}
        selectedIds={stagedTemplateIds}
        onToggle={(tid: string) =>
          setStagedTemplateIds((s) => (s.includes(tid) ? s.filter((x) => x !== tid) : [...s, tid]))
        }
        showMusic={booking.hasMusicFormConfig}
      />
      {stagedTemplateIds.length > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-primary/5 p-3">
          <Button
            size="sm"
            onClick={() => applyStagedTemplates.mutate(stagedTemplateIds)}
            disabled={applyStagedTemplates.isPending}
          >
            {applyStagedTemplates.isPending ? 'Applying…' : `Apply ${pluralPackages(stagedTemplateIds.length)}`}
          </Button>
          <p className="text-xs text-muted">Staged — nothing is added until you Apply.</p>
        </div>
      )}
    </BuilderSection>
  );
}
