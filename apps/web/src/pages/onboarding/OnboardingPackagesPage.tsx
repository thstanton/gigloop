import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { apiGet, apiPatch } from '@/lib/api';
import type { Package } from '@/types/api';

export default function OnboardingPackagesPage() {
  const navigate = useNavigate();
  const { isLoaded } = useAuth();
  const queryClient = useQueryClient();

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['packages'],
    queryFn: () => apiGet<Package[]>('/packages'),
    enabled: isLoaded,
  });

  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (packages.length > 0) {
      const initial = new Map(packages.map((p) => [p.id, p.enabled]));
      setOverrides(initial);
    }
  }, [packages]);

  const { mutate: saveChanges, isPending } = useMutation({
    mutationFn: async () => {
      const changed = packages.filter((p) => overrides.get(p.id) !== p.enabled);
      await Promise.all(
        changed.map((p) =>
          apiPatch(`/packages/${p.id}`, { enabled: overrides.get(p.id) }),
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      navigate('/onboarding/checklist');
    },
  });

  const grouped = packages.reduce<Record<string, Package[]>>((acc, p) => {
    const cat = p.category ?? 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  function handleNext() {
    const hasChanges = packages.some((p) => overrides.get(p.id) !== p.enabled);
    if (hasChanges) saveChanges();
    else navigate('/onboarding/checklist');
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Choose your packages</h1>
        <p className="text-base text-muted mt-1">
          Enable the packages you offer. You can update these any time in Settings.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-border/40 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(grouped).map(([category, pkgs]) => (
            <div key={category}>
              <h2 className="text-base font-medium text-foreground mb-2">{category}</h2>
              <div className="rounded-lg border border-border divide-y divide-border">
                {pkgs.map((pkg) => (
                  <label
                    key={pkg.id}
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{pkg.icon}</span>
                      <span className="text-base text-foreground">{pkg.label}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={overrides.get(pkg.id) ?? pkg.enabled}
                      onChange={(e) =>
                        setOverrides((prev) => new Map(prev).set(pkg.id, e.target.checked))
                      }
                      className="accent-primary"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start gap-3 pt-2">
        <button
          type="button"
          onClick={handleNext}
          disabled={isPending}
          className="rounded-lg bg-primary text-primary-foreground text-base font-medium px-6 py-2.5 transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {isPending ? 'Saving…' : 'Next'}
        </button>
        <button
          type="button"
          onClick={() => navigate('/onboarding/checklist')}
          className="text-base text-muted underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Skip for now — customise in Settings
        </button>
      </div>

      <button
        type="button"
        onClick={() => navigate('/onboarding/songs')}
        className="text-sm text-muted hover:text-foreground transition-colors self-start"
      >
        ← Back
      </button>
    </div>
  );
}
