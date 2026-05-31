import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { apiGet, apiPatch, apiPost } from '@/lib/api';
import type { UserProfile, ChecklistDefaultItem } from '@/types/api';

const STAGE_ORDER = ['PROVISIONAL', 'CONFIRMED', 'READY', 'COMPLETE'] as const;
const STAGE_LABELS: Record<string, string> = {
  PROVISIONAL: 'Provisional',
  CONFIRMED: 'Confirmed',
  READY: 'Ready',
  COMPLETE: 'Complete',
};

export default function OnboardingChecklistPage() {
  const navigate = useNavigate();
  const { isLoaded } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<UserProfile>('/me'),
    enabled: isLoaded,
  });

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
          .map((d) => ({
            key: d.key!,
            enabled: overrides.get(d.key!) ?? true,
          }));
        await apiPatch('/me/preferences/checklist-defaults', {
          systemItemOverrides: systemOverrides,
        });
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
                    return (
                      <label
                        key={key}
                        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/10 transition-colors"
                      >
                        <span className="text-base text-foreground">{item.label}</span>
                        <input
                          type="checkbox"
                          checked={overrides.get(key) ?? true}
                          onChange={(e) =>
                            setOverrides((prev) => new Map(prev).set(key, e.target.checked))
                          }
                          className="accent-primary"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start gap-3 pt-2">
        <button
          type="button"
          onClick={() => finish(false)}
          disabled={isPending}
          className="rounded-lg bg-primary text-primary-foreground text-base font-medium px-6 py-2.5 transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {isPending ? 'Finishing…' : 'Finish'}
        </button>
        <button
          type="button"
          onClick={() => finish(true)}
          disabled={isPending}
          className="text-base text-muted underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Skip for now — customise in Settings
        </button>
      </div>

      <button
        type="button"
        onClick={() => navigate('/onboarding/packages')}
        className="text-sm text-muted hover:text-foreground transition-colors self-start"
      >
        ← Back
      </button>
    </div>
  );
}
