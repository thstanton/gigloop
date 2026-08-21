import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiGet, apiPatch } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import { isEnabled } from '@/lib/featureFlags';
import { PACKAGE_CATEGORY_LABELS, PACKAGE_CATEGORY_ORDER } from '@/lib/constants';
import type { LineupTemplate, PackageTemplate, UpdatePackageInput } from '@/types/api';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { PageSection } from '@/components/common/PageSection';
import { PackageIcon } from '@/components/common/PackageIcon';
import { PackageMusicSummary } from '@/features/packages/PackageMusicSummary';
import { PackageDrawer, type PackageDrawerMode } from '@/features/packages/PackageDrawer';
import { LineupList } from '@/features/packages/LineupList';
import { LineupDrawer, type LineupDrawerMode } from '@/features/packages/LineupDrawer';

const BAND_MEMBERS_FLAG = 'VITE_FEATURE_BAND_MEMBERS';

// ─── Package card ─────────────────────────────────────────────────────────────

function PackageCard({
  pkg,
  onEdit,
}: {
  pkg: PackageTemplate;
  onEdit: (pkg: PackageTemplate) => void;
}) {
  const qc = useQueryClient();

  const toggle = useMutation({
    mutationFn: (enabled: boolean) =>
      apiPatch<PackageTemplate>(`/packages/${pkg.id}`, { enabled } as UpdatePackageInput),
    onMutate: async (enabled) => {
      await qc.cancelQueries({ queryKey: ['packages'] });
      const previous = qc.getQueryData<PackageTemplate[]>(['packages']);
      qc.setQueryData<PackageTemplate[]>(['packages'], (old) =>
        old?.map((p) => (p.id === pkg.id ? { ...p, enabled } : p)),
      );
      return { previous };
    },
    onError: (_err, _enabled, context) => {
      if (context?.previous) qc.setQueryData(['packages'], context.previous);
      toast({ title: 'Failed to update package', variant: 'destructive' });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['packages'] }),
  });

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <PackageIcon icon={pkg.icon} size={15} strokeWidth={1.75} />
          </div>
          <span className="text-sm font-medium text-foreground truncate">{pkg.label}</span>
        </div>
        <Switch
          checked={pkg.enabled}
          onCheckedChange={(checked) => toggle.mutate(checked)}
          aria-label={pkg.enabled ? 'Disable package' : 'Enable package'}
        />
      </div>

      {pkg.slots.length > 0 && (
        <ul className="space-y-1">
          {pkg.slots.map((slot) => (
            <li key={slot.id} className="text-sm text-muted flex items-center gap-2">
              <span className="flex-1 truncate">{slot.label || 'Unnamed'}</span>
              <span className="flex-shrink-0">{slot.duration} min</span>
            </li>
          ))}
        </ul>
      )}

      {/* Intrinsic template data on the management surface — always shown when present (no gate). */}
      <PackageMusicSummary genres={pkg.defaultGenreSelection} moments={pkg.keyMoments} />

      <Button
        variant="outline"
        size="sm"
        onClick={() => onEdit(pkg)}
        className="w-full"
      >
        Edit
      </Button>
    </Card>
  );
}

// ─── Category group ───────────────────────────────────────────────────────────

function CategoryGroup({
  title,
  packages,
  onEdit,
}: {
  title: string;
  packages: PackageTemplate[];
  onEdit: (pkg: PackageTemplate) => void;
}) {
  if (packages.length === 0) return null;
  return (
    <section>
      <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {packages.map((pkg) => (
          <PackageCard key={pkg.id} pkg={pkg} onEdit={onEdit} />
        ))}
      </div>
    </section>
  );
}

// ─── Lineups tab ────────────────────────────────────────────────────────────

function LineupsTab() {
  const { isLoaded } = useAuth();
  const [drawerMode, setDrawerMode] = useState<LineupDrawerMode | null>(null);

  const { data: lineups = [], isLoading } = useQuery({
    queryKey: ['lineups'],
    queryFn: () => apiGet<LineupTemplate[]>('/lineups'),
    enabled: isLoaded,
  });

  return (
    <div className="space-y-6">
      <PageSection title="Lineups">
        <Button onClick={() => setDrawerMode({ type: 'create' })}>+ New lineup</Button>
      </PageSection>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 bg-surface rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <LineupList
          lineups={lineups}
          onEdit={(lineup) => setDrawerMode({ type: 'edit', lineup })}
          onCreate={() => setDrawerMode({ type: 'create' })}
        />
      )}

      {drawerMode && (
        <LineupDrawer mode={drawerMode} open={drawerMode != null} onClose={() => setDrawerMode(null)} />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PackagesPage() {
  const { isLoaded } = useAuth();
  const [drawerMode, setDrawerMode] = useState<PackageDrawerMode | null>(null);
  const bandMembersEnabled = isEnabled(BAND_MEMBERS_FLAG);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['packages'],
    queryFn: () => apiGet<PackageTemplate[]>('/packages'),
    enabled: isLoaded,
  });

  const grouped = PACKAGE_CATEGORY_ORDER.reduce<Record<string, PackageTemplate[]>>((acc, cat) => {
    acc[cat] = packages.filter((p) => p.category === cat);
    return acc;
  }, {});
  const uncategorised = packages.filter((p) => !p.category);

  const packagesPanel = (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Package Templates</h1>
        <Button onClick={() => setDrawerMode({ type: 'create' })}>+ New package</Button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-surface rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && packages.length === 0 && (
        <EmptyState
          icon={<Music size={40} strokeWidth={1.5} />}
          heading="No package templates yet"
          description="Create a package template to get started."
          action={<Button onClick={() => setDrawerMode({ type: 'create' })}>New package</Button>}
        />
      )}

      {!isLoading && packages.length > 0 && (
        <div className="space-y-8">
          {PACKAGE_CATEGORY_ORDER.map((cat) => (
            <CategoryGroup
              key={cat}
              title={PACKAGE_CATEGORY_LABELS[cat]}
              packages={grouped[cat]}
              onEdit={(pkg) => setDrawerMode({ type: 'edit', pkg })}
            />
          ))}
          <CategoryGroup
            title="Uncategorised"
            packages={uncategorised}
            onEdit={(pkg) => setDrawerMode({ type: 'edit', pkg })}
          />
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {bandMembersEnabled ? (
        <Tabs defaultValue="packages">
          <TabsList>
            <TabsTrigger value="packages">Packages</TabsTrigger>
            <TabsTrigger value="lineups">Lineups</TabsTrigger>
          </TabsList>
          <TabsContent value="packages" className="pt-4">{packagesPanel}</TabsContent>
          <TabsContent value="lineups" className="pt-4"><LineupsTab /></TabsContent>
        </Tabs>
      ) : (
        packagesPanel
      )}

      {drawerMode && (
        <PackageDrawer
          mode={drawerMode}
          open={drawerMode != null}
          onClose={() => setDrawerMode(null)}
        />
      )}
    </div>
  );
}
