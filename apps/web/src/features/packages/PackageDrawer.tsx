import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { apiDelete, apiPatch, apiPost } from '@/lib/api';
import type { CreatePackageInput, PackageTemplate, UpdatePackageInput } from '@/types/api';
import { PackageIcon } from '@/components/common/PackageIcon';
import {
  PackageForm,
  emptyPackageFormValues,
  packageToFormValues,
  packageFormToPayload,
  type PackageFormValues,
} from './PackageForm';

// The shared create/edit drawer for a Package Template. Extracted from PackagesPage (#755) so the
// New Booking form can open the same Sheet without leaving the flow. `onCreated` lets a caller
// auto-select the new template; `initialValues` seeds the create form. Neither is used by
// /admin/packages, whose behaviour is unchanged.

export type PackageDrawerMode = { type: 'create' } | { type: 'edit'; pkg: PackageTemplate };

// api.ts rejects with a `Response`, never an `Error` — so reading `.message` off it yields
// undefined and renders an empty paragraph, i.e. a silent failure. Mirrors the
// `error instanceof Response && error.status === …` idiom used across the booking sheets.
function saveErrorMessage(error: unknown): string {
  if (error instanceof Response && error.status === 409) {
    return 'A package template with that name already exists.';
  }
  return 'Could not save this package template. Please try again.';
}

// The edit-only delete footer: owns the confirm step, its error, and the delete mutation.
function DeletePackageSection({ pkgId, onDeleted }: { pkgId: string; onDeleted: () => void }) {
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const deletePkg = useMutation({
    mutationFn: () => apiDelete(`/packages/${pkgId}`),
    onSuccess: onDeleted,
    onError: (err: Error) => {
      setDeleteError(err.message || 'This package is used by existing bookings and cannot be deleted');
      setConfirmDelete(false);
    },
  });

  return (
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
  );
}

interface PackageDrawerProps {
  mode: PackageDrawerMode;
  open: boolean;
  onClose: () => void;
  /** Seeds a create-mode form (e.g. category from the booking's event type). Ignored when editing. */
  initialValues?: Partial<PackageFormValues>;
  /** Fired with the created template on a successful create, before the cache is invalidated. */
  onCreated?: (created: PackageTemplate) => void;
}

export function PackageDrawer({
  mode,
  open,
  onClose,
  initialValues,
  onCreated,
}: PackageDrawerProps) {
  const qc = useQueryClient();
  const isEdit = mode.type === 'edit';
  const existing = isEdit ? mode.pkg : null;

  const initialForm = () => (existing ? packageToFormValues(existing) : { ...emptyPackageFormValues(), ...initialValues });
  const [form, setForm] = useState<PackageFormValues>(initialForm);

  // Reset when the drawer opens (or switches mode).
  const [lastMode, setLastMode] = useState<PackageDrawerMode | null>(null);
  if (open && mode !== lastMode) {
    setLastMode(mode);
    setForm(initialForm());
  }

  const save = useMutation({
    mutationFn: () => {
      const payload = packageFormToPayload(form);
      if (isEdit) {
        return apiPatch<PackageTemplate>(`/packages/${existing!.id}`, payload as UpdatePackageInput);
      }
      return apiPost<PackageTemplate>('/packages', payload as CreatePackageInput);
    },
    onSuccess: (saved) => {
      if (!isEdit) onCreated?.(saved);
      qc.invalidateQueries({ queryKey: ['packages'] });
      onClose();
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
            <p className="text-sm text-status-cancelled">{saveErrorMessage(save.error)}</p>
          )}
          <Button
            onClick={() => save.mutate()}
            disabled={!form.label.trim() || save.isPending}
            className="w-full"
          >
            {save.isPending ? 'Saving…' : 'Save changes'}
          </Button>

          {existing && (
            <DeletePackageSection
              key={existing.id}
              pkgId={existing.id}
              onDeleted={() => {
                qc.invalidateQueries({ queryKey: ['packages'] });
                onClose();
              }}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
