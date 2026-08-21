import { useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { IconButton } from '@/components/common/IconButton';
import { useDatalistId } from '@/lib/hooks/useDatalistId';

// Declared capability, a free-text tag list sharing one soft-matched vocabulary with chair roles
// (#886, ADR-0072 §4) — type-ahead via the browser's native <datalist>, not a closed enum. Enter
// or comma commits the current text as a tag; each tag can be removed individually.
export function InstrumentsInput({
  value,
  onChange,
  vocabulary,
  disabled = false,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  vocabulary: string[];
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const datalistId = useDatalistId();

  function commit() {
    const trimmed = draft.trim();
    if (!trimmed || value.includes(trimmed)) {
      setDraft('');
      return;
    }
    onChange([...value, trimmed]);
    setDraft('');
  }

  function remove(instrument: string) {
    onChange(value.filter((v) => v !== instrument));
  }

  return (
    <div className="space-y-2">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        placeholder="e.g. Saxophone — press Enter to add"
        list={datalistId}
        disabled={disabled}
      />
      <datalist id={datalistId}>
        {vocabulary.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((instrument) => (
            <li
              key={instrument}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-sm text-foreground"
            >
              {instrument}
              <IconButton
                label={`Remove ${instrument}`}
                onClick={() => remove(instrument)}
                disabled={disabled}
                className="min-h-0 min-w-0 h-4 w-4 hover:text-status-cancelled"
              >
                <X size={12} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
