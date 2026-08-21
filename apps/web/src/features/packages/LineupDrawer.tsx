import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { apiDelete, apiPatch, apiPost } from '@/lib/api';
import { useRoleVocabulary } from '@/lib/hooks/useRoleVocabulary';
import type { CreateLineupInput, LineupTemplate, UpdateLineupInput } from '@/types/api';
import {
  LineupForm,
  emptyLineupFormValues,
  lineupToFormValues,
  lineupFormToPayload,
  type LineupFormValues,
} from './LineupForm';

// The lineup counterpart to PackageDrawer (#879, ADR-0072 §3) — same create/edit Sheet shape.
// Unlike PackagesController, there is no unique constraint on a lineup's label and no 409 branch
// in LineupsController, so save failures get one plain fallback message rather than PackageDrawer's
// 409-vs-other split (that split exists there because the 409 is real, in-band and reachable).

function DeleteLineupSection({ lineupId, onDeleted }: { lineupId: string; onDeleted: () => void }) {
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const deleteLineup = useMutation({
    mutationFn: () => apiDelete(`/lineups/${lineupId}`),
    onSuccess: onDeleted,
    onError: () => {
      setDeleteError('Could not delete this lineup. Please try again.');
      setConfirmDelete(false);
    },
  });

  return (
    <>
      {deleteError && <p className="text-sm text-status-cancelled">{deleteError}</p>}
      {confirmDelete ? (
        <div className="flex gap-2">
          <Button
            variant="destructive"
            onClick={() => deleteLineup.mutate()}
            disabled={deleteLineup.isPending}
            className="flex-1"
          >
            {deleteLineup.isPending ? 'Deleting…' : 'Confirm delete'}
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
          Delete lineup
        </Button>
      )}
    </>
  );
}

export type LineupDrawerMode = { type: 'create' } | { type: 'edit'; lineup: LineupTemplate };

interface LineupDrawerProps {
  mode: LineupDrawerMode;
  open: boolean;
  onClose: () => void;
}

export function LineupDrawer({ mode, open, onClose }: LineupDrawerProps) {
  const qc = useQueryClient();
  const roleVocabulary = useRoleVocabulary();
  const isEdit = mode.type === 'edit';
  const existing = isEdit ? mode.lineup : null;

  const initialForm = () => (existing ? lineupToFormValues(existing) : emptyLineupFormValues());
  const [form, setForm] = useState<LineupFormValues>(initialForm);

  // Reset on the closed→open edge — see PackageDrawer's identical pattern for why this is keyed
  // on `open` rather than `mode` identity.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setForm(initialForm());
  }

  const save = useMutation({
    mutationFn: () => {
      const payload = lineupFormToPayload(form);
      if (isEdit) {
        return apiPatch<LineupTemplate>(`/lineups/${existing!.id}`, payload as UpdateLineupInput);
      }
      return apiPost<LineupTemplate>('/lineups', payload as CreateLineupInput);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lineups'] });
      onClose();
    },
  });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto flex flex-col gap-0 p-0">
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border flex-shrink-0">
          <SheetTitle className="text-base">{isEdit ? 'Edit lineup' : 'New lineup'}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <LineupForm
            value={form}
            onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
            roleVocabulary={roleVocabulary}
          />
        </div>

        <div className="border-t border-border px-5 py-4 flex-shrink-0 space-y-3">
          {save.error && (
            <p className="text-sm text-status-cancelled">Could not save this lineup. Please try again.</p>
          )}
          <Button onClick={() => save.mutate()} disabled={!form.label.trim() || save.isPending} className="w-full">
            {save.isPending ? 'Saving…' : 'Save changes'}
          </Button>

          {existing && (
            <DeleteLineupSection
              key={existing.id}
              lineupId={existing.id}
              onDeleted={() => {
                qc.invalidateQueries({ queryKey: ['lineups'] });
                onClose();
              }}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
