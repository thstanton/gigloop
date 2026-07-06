import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { apiPatch } from '@/lib/api';
import { CHECKLIST_STAGE_ORDER, BOOKING_STATUS_LABELS } from '@/lib/constants';
import { useMe } from '@/lib/hooks/useMe';
import { toast } from '@/lib/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/common/PageHeader';
import { PageSection } from '@/components/common/PageSection';
import { stepNav } from '@/features/onboarding/steps';
import type { ChecklistDefaultItem, BookingStatus } from '@/types/api';

const PATH = '/onboarding/checklist';

export default function OnboardingChecklistPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { prev, next } = stepNav(PATH);

  const { data: profile, isLoading } = useMe();

  const defaults = (profile?.preferences?.checklistDefaults ?? []) as ChecklistDefaultItem[];

  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (defaults.length > 0) {
      setOverrides(new Map(defaults.map((d) => [d.key ?? d.label, d.enabled !== false])));
    }
  }, [defaults.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const { mutate: save, isPending } = useMutation({
    mutationFn: async () => {
      const systemOverrides = defaults
        .filter((d) => d.key)
        .filter((d) => (overrides.get(d.key!) ?? true) !== (d.enabled !== false))
        .map((d) => ({
          key: d.key!,
          enabled: overrides.get(d.key!) ?? true,
        }));
      if (systemOverrides.length > 0) {
        await apiPatch('/me/preferences/checklist-defaults', {
          systemItemOverrides: systemOverrides,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      if (next) navigate(next);
    },
    onError: () => {
      toast({ title: 'Failed to save. Please try again.', variant: 'destructive' });
    },
  });

  const stages = CHECKLIST_STAGE_ORDER.filter((s): s is BookingStatus => !!s && s !== 'ENQUIRY' && s !== 'CANCELLED');
  const grouped = stages.reduce<Record<string, ChecklistDefaultItem[]>>((acc, stage) => {
    acc[stage] = defaults.filter((d) => d.requiredForStatus === stage);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Booking checklist defaults"
        subheading="These are the tasks GigLoop will track for every booking. You can customise them fully in Settings → Booking defaults."
        className="mb-0"
      />

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-border/40 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {stages.map((stage) => {
            const items = grouped[stage] ?? [];
            if (items.length === 0) return null;
            return (
              <div key={stage}>
                <PageSection title={BOOKING_STATUS_LABELS[stage]} className="mb-2" />
                <div className="rounded-lg border border-border divide-y divide-border">
                  {items.map((item) => {
                    const key = item.key ?? item.label;
                    const checked = overrides.get(key) ?? true;
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between px-4 py-3"
                      >
                        <span className="text-base text-foreground">{item.label}</span>
                        <Switch
                          checked={checked}
                          onCheckedChange={(val) =>
                            setOverrides((prev) => new Map(prev).set(key, val))
                          }
                          aria-label={`${item.label}: ${checked ? 'enabled' : 'disabled'}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start gap-3 pt-2">
        {prev && (
          <Button variant="outline" onClick={() => navigate(prev)}>
            Back
          </Button>
        )}
        <Button onClick={() => save()} disabled={isPending}>
          {isPending ? 'Saving…' : 'Next'}
        </Button>
        {next && (
          <Button variant="ghost" onClick={() => navigate(next)} disabled={isPending}>
            Skip for now — customise in Settings
          </Button>
        )}
      </div>
    </div>
  );
}
