import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Music } from 'lucide-react';
import { apiGet, apiPatch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { PACKAGE_CATEGORY_LABELS, PACKAGE_ICON_MAP } from '@/lib/constants';
import { PageHeader } from '@/components/common/PageHeader';
import { PageSection } from '@/components/common/PageSection';
import type { Package } from '@/types/api';

function PackageIcon({ icon }: { icon: string }) {
  const Icon = PACKAGE_ICON_MAP[icon] ?? Music;
  return <Icon size={18} strokeWidth={1.75} />;
}

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
      setOverrides(new Map(packages.map((p) => [p.id, p.enabled])));
    }
  }, [packages.length]); // eslint-disable-line react-hooks/exhaustive-deps

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
      <PageHeader
        title="Choose your packages"
        subheading="Enable the packages you offer. You can update these any time in Settings."
        className="mb-0"
      />

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
              <PageSection title={PACKAGE_CATEGORY_LABELS[category] ?? category} className="mb-2" />
              <div className="rounded-lg border border-border divide-y divide-border">
                {pkgs.map((pkg) => {
                  const checked = overrides.get(pkg.id) ?? pkg.enabled;
                  return (
                    <div
                      key={pkg.id}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <div className="flex items-center gap-3 text-muted">
                        <PackageIcon icon={pkg.icon} />
                        <span className="text-base text-foreground">{pkg.label}</span>
                      </div>
                      <Switch
                        checked={checked}
                        onCheckedChange={(val) =>
                          setOverrides((prev) => new Map(prev).set(pkg.id, val))
                        }
                        aria-label={`${pkg.label}: ${checked ? 'enabled' : 'disabled'}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start gap-3 pt-2">
        <Button variant="outline" onClick={() => navigate('/onboarding/songs')}>
          Back
        </Button>
        <Button onClick={handleNext} disabled={isPending}>
          {isPending ? 'Saving…' : 'Next'}
        </Button>
        <Button variant="ghost" onClick={() => navigate('/onboarding/checklist')}>
          Skip for now
        </Button>
      </div>
    </div>
  );
}
