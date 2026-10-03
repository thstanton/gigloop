import { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { IconButton } from '@/components/common/IconButton';
import { Input } from '@/components/ui/input';
import { formatFee } from '@/lib/formatters';

// The app's ONE fee editor. #983 found two doing the same job with different markup — this, for the
// booking fee, and BandMemberRow's own for the session fee, whose trigger rendered `text-muted` and
// so read as a label rather than a control. #987 gave this one a `value` seed and deleted the other
// rather than letting a third appear.
//
// Trigger convention (shared with DueDateEditor, GoalRow, AddSongField, PackageForm): an editable
// value is `text-primary hover:underline` — `£180 ✎` when set, `+ Add fee` when not.

export interface InlineFeeAddProps {
  /** Current fee, as the API's decimal string. Omit (or null) for the add-a-fee case. */
  value?: string | null;
  onSave: (fee: number | null) => void;
  isSaving: boolean;
  /** Distinguishes several of these on one screen (one per player on the Band sheet). */
  label?: string;
  /** Controlled open state, for a host that opens the editor from elsewhere (the Players card's
   *  "Change fee" menu item). Omit for the self-managed trigger. */
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
}

export default function InlineFeeAdd({
  value = null,
  onSave,
  isSaving,
  label = 'fee',
  editing: editingProp,
  onEditingChange,
}: InlineFeeAddProps) {
  const [editingInternal, setEditingInternal] = useState(false);
  // `null` = untouched, so the field seeds from the current value however the editor was opened.
  const [typed, setTyped] = useState<string | null>(null);
  const editing = editingProp ?? editingInternal;
  const draft = typed ?? value ?? '';
  const setDraft = setTyped;
  const setEditing = (next: boolean) => {
    setEditingInternal(next);
    onEditingChange?.(next);
  };

  const formatted = formatFee(value ?? null);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={formatted ? `Edit ${label}` : `Add ${label}`}
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        {formatted ? (
          <>
            {formatted}
            <Pencil size={11} />
          </>
        ) : (
          '+ Add fee'
        )}
      </button>
    );
  }

  // Clearing the field saves `null` — how a fee set by mistake is taken off again. The predecessor
  // could only ever set one, so a wrong fee was unremovable from the sheet.
  function commit() {
    const trimmed = draft.trim();
    if (trimmed === '') {
      onSave(null);
    } else {
      const parsed = Number(trimmed);
      if (Number.isNaN(parsed)) return;
      onSave(parsed);
    }
    setEditing(false);
    setDraft(null);
  }

  // A div, not a <form>: this editor sits inside the Builder's own form (#991) and inside the Band
  // sheet, and a nested <form> is invalid HTML. Enter commits explicitly instead of by submission.
  return (
    <div className="flex items-center gap-2">
      <Input
        autoFocus
        type="number"
        min="0"
        step="0.01"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { setEditing(false); setDraft(null); }
        }}
        placeholder="0.00"
        aria-label={`${label} amount`}
        className="h-8 w-28 text-sm"
        disabled={isSaving}
      />
      <button
        type="button"
        onClick={commit}
        disabled={isSaving}
        className="text-status-confirmed hover:text-status-confirmed/70 disabled:opacity-40 transition-colors"
        aria-label={`Save ${label}`}
      >
        <Check size={16} />
      </button>
      <IconButton label={`Cancel ${label}`} onClick={() => { setEditing(false); setDraft(null); }}>
        <X size={16} />
      </IconButton>
    </div>
  );
}
