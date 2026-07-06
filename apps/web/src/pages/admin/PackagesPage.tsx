import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import { PACKAGE_CATEGORY_LABELS, PACKAGE_CATEGORY_ORDER } from '@/lib/constants';
import type { CreatePackageInput, PackageTemplate, UpdatePackageInput } from '@/types/api';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { PackageIcon } from '@/components/common/PackageIcon';
import { PackageMusicSummary } from '@/features/packages/PackageMusicSummary';
import {
  PackageForm,
  emptyPackageFormValues,
  packageToFormValues,
  packageFormToPayload,
  type PackageFormValues,
} from '@/features/packages/PackageForm';

// ─── Package drawer ───────────────────────────────────────────────────────────

type DrawerMode = { type: 'create' } | { type: 'edit'; pkg: PackageTemplate };

function PackageDrawer({
  mode,
  open,
  onClose,
}: {
  mode: DrawerMode;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = mode.type === 'edit';
  const existing = isEdit ? mode.pkg : null;

  const [form, setForm] = useState<PackageFormValues>(
    existing ? packageToFormValues(existing) : emptyPackageFormValues(),
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset when the drawer opens (or switches mode).
  const [lastMode, setLastMode] = useState<DrawerMode | null>(null);
  if (open && mode !== lastMode) {
    setLastMode(mode);
    setForm(existing ? packageToFormValues(existing) : emptyPackageFormValues());
    setDeleteError(null);
    setConfirmDelete(false);
  }

  const save = useMutation({
    mutationFn: () => {
      const payload = packageFormToPayload(form);
      if (isEdit) {
        return apiPatch<PackageTemplate>(`/packages/${existing!.id}`, payload as UpdatePackageInput);
      }
      return apiPost<PackageTemplate>('/packages', payload as CreatePackageInput);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packages'] });
      onClose();
    },
  });

  const deletePkg = useMutation({
    mutationFn: () => apiDelete(`/packages/${existing!.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packages'] });
      onClose();
    },
    onError: (err: Error) => {
      setDeleteError(err.message || 'This package is used by existing bookings and cannot be deleted');
      setConfirmDelete(false);
    },
  });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto flex flex-col gap-0 p-0">
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <PackageIcon icon={form.icon} size={16} strokeWidth={1.75} />
            </div>
            <SheetTitle className="text-base">
              {isEdit ? 'Edit package' : 'New package'}
            </SheetTitle>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <PackageForm value={form} onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} />
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-4 flex-shrink-0 space-y-3">
          {save.error && (
            <p className="text-sm text-status-cancelled">{(save.error as Error).message}</p>
          )}
          <Button
            onClick={() => save.mutate()}
            disabled={!form.label.trim() || save.isPending}
            className="w-full"
          >
            {save.isPending ? 'Saving…' : 'Save changes'}
          </Button>

          {isEdit && (
            <>
              {deleteError && (
                <p className="text-sm text-status-cancelled">{deleteError}</p>
              )}
              {confirmDelete ? (
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={() => deletePkg.mutate()}
                    disabled={deletePkg.isPending}
                    className="flex-1"
                  >
                    {deletePkg.isPending ? 'Deleting…' : 'Confirm delete'}
                  </Button>
                  <Button variant="outline" onClick={() => setConfirmDelete(false)} className="flex-1">
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => setConfirmDelete(true)}
                  className="w-full text-status-cancelled hover:text-status-cancelled"
                >
                  Delete package
                </Button>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PackagesPage() {
  const { isLoaded } = useAuth();
  const [drawerMode, setDrawerMode] = useState<DrawerMode | null>(null);

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

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
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
