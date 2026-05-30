import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { IconButton } from '@/components/common/IconButton';
import { Input } from '@/components/ui/input';

export interface InlineFeeAddProps {
  onSave: (fee: number) => void;
  isSaving: boolean;
}

export default function InlineFeeAdd({ onSave, isSaving }: InlineFeeAddProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-sm text-primary hover:underline"
      >
        + Add fee
      </button>
    );
  }

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = value.trim();
        if (trimmed) {
          onSave(parseFloat(trimmed));
          setEditing(false);
          setValue('');
        }
      }}
    >
      <Input
        autoFocus
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="0.00"
        className="h-8 w-28 text-sm"
        disabled={isSaving}
      />
      <button
        type="submit"
        disabled={!value.trim() || isSaving}
        className="text-status-confirmed hover:text-status-confirmed/70 disabled:opacity-40 transition-colors"
        aria-label="Save fee"
      >
        <Check size={16} />
      </button>
      <IconButton label="Cancel" onClick={() => { setEditing(false); setValue(''); }}>
        <X size={16} />
      </IconButton>
    </form>
  );
}
