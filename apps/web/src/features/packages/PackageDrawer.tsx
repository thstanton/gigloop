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

// api.ts rejects with a `Response`, never an `Error`, and discards the API's JSON body on the way
// (`throw new Response(res.statusText, …)`) — so `.message` is always undefined and the copy has to
// be reconstructed from the status. Hand-rolling that per call site is a known wart, not a pattern
// to copy: this is the 8th site to do it, and reading `.message` off a `Response` had already
// produced one silent failure here. See #768 on giving api.ts a real error type.
function apiErrorMessage(error: unknown, whenConflict: string, fallback: string): string {
  return error instanceof Response && error.status === 409 ? whenConflict : fallback;
}

// The edit-only delete footer: owns the confirm step, its error, and the delete mutation.
function DeletePackageSection({ pkgId, onDeleted }: { pkgId: string; onDeleted: () => void }) {
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const deletePkg = useMutation({
    mutationFn: () => apiDelete(`/packages/${pkgId}`),
    onSuccess: onDeleted,
    onError: (err) => {
      setDeleteError(
        apiErrorMessage(
          err,
          'This package is used by existing bookings and cannot be deleted',
          'Could not delete this package template. Please try again.',
        ),
      );
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

  // Reset on the closed→open edge, so each open starts from the current mode/initialValues.
  // Deliberately keyed on `open` rather than on the identity of `mode`: identity forced every
  // caller to hand over a brand-new object per open (and, if it kept the drawer mounted for the
  // close animation, to invent a stable dummy for the closed state) — an unwritten contract that
  // a memoised `mode` would have broken silently. Matches InvoiceSheet, the app's other
  // always-mounted form sheet. The only case this drops is switching target while open (edit A →
  // edit B without closing), which neither caller can reach.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setForm(initialForm());
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
            <p className="text-sm text-status-cancelled">
              {apiErrorMessage(
                save.error,
                'A package template with that name already exists.',
                'Could not save this package template. Please try again.',
              )}
            </p>
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
