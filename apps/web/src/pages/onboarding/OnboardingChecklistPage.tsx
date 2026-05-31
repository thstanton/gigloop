import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { apiPatch, apiPost } from '@/lib/api';
import { useMe } from '@/lib/hooks/useMe';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { ChecklistDefaultItem } from '@/types/api';

const STAGE_ORDER = ['PROVISIONAL', 'CONFIRMED', 'READY', 'COMPLETE'] as const;
const STAGE_LABELS: Record<string, string> = {
  PROVISIONAL: 'Provisional',
  CONFIRMED: 'Confirmed',
  READY: 'Ready',
  COMPLETE: 'Complete',
};

export default function OnboardingChecklistPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useMe();

  const defaults = (profile?.preferences?.checklistDefaults ?? []) as ChecklistDefaultItem[];

  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (defaults.length > 0) {
      setOverrides(new Map(defaults.map((d) => [d.key ?? d.label, d.enabled !== false])));
    }
  }, [defaults.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const { mutate: finish, isPending } = useMutation({
    mutationFn: async (skipPatch: boolean) => {
      if (!skipPatch) {
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
      }
      await apiPost('/me/onboarding/complete', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      navigate('/admin', { replace: true });
    },
  });

  const grouped = STAGE_ORDER.reduce<Record<string, ChecklistDefaultItem[]>>((acc, stage) => {
    acc[stage] = defaults.filter((d) => d.requiredForStatus === stage);
    return acc;
  }, {} as Record<string, ChecklistDefaultItem[]>);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Booking checklist defaults</h1>
        <p className="text-base text-muted mt-1">
          These are the tasks GigMan will track for every booking. You can customise them fully in Settings → Booking defaults.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-border/40 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {STAGE_ORDER.map((stage) => {
            const items = grouped[stage] ?? [];
            if (items.length === 0) return null;
            return (
              <div key={stage}>
                <h2 className="text-base font-medium text-foreground mb-2">{STAGE_LABELS[stage]}</h2>
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
        <Button variant="outline" onClick={() => navigate('/onboarding/packages')}>
          Back
        </Button>
        <Button onClick={() => finish(false)} disabled={isPending}>
          {isPending ? 'Finishing…' : 'Finish'}
        </Button>
        <Button variant="ghost" onClick={() => finish(true)} disabled={isPending}>
          Skip for now
        </Button>
      </div>
    </div>
  );
}
