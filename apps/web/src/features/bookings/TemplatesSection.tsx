import { Button } from '@/components/ui/button';
import { BuilderSection } from '@/features/bookings/BuilderSection';
import { MusicFormSuggestionBanner } from '@/features/bookings/MusicFormSuggestionBanner';
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
        <MusicFormSuggestionBanner
          suggestion={pendingSuggestion}
          onAccept={() => acceptSuggestion.mutate(pendingSuggestion)}
          onDismiss={() => setPendingSuggestion(null)}
          isAccepting={acceptSuggestion.isPending}
        />
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
