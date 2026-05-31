import { useEffect, useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';

export interface InlineNotesProps {
  notes: string | null;
  onSave: (notes: string) => void;
  isSaving: boolean;
}

export default function InlineNotes({ notes, onSave, isSaving }: Readonly<InlineNotesProps>) {
  const [value, setValue] = useState(notes ?? '');
  const [savedVisible, setSavedVisible] = useState(false);
  const lastSavedRef = useRef(notes ?? '');
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevIsSavingRef = useRef(isSaving);
  const isSavingRef = useRef(isSaving);
  const onSaveRef = useRef(onSave);

  // Keep refs current without triggering effects
  isSavingRef.current = isSaving;
  onSaveRef.current = onSave;

  // Show "Saved" feedback when a save completes
  useEffect(() => {
    if (prevIsSavingRef.current && !isSaving) {
      setSavedVisible(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSavedVisible(false), 2000);
    }
    prevIsSavingRef.current = isSaving;
  }, [isSaving]);

  // Sync from server when notes prop changes (e.g. after drawer save)
  useEffect(() => {
    lastSavedRef.current = notes ?? '';
    if (!isSavingRef.current) {
      setValue(notes ?? '');
    }
  }, [notes]);

  // Debounced auto-save — only re-runs when value changes
  useEffect(() => {
    if (value === lastSavedRef.current) return;
    const timer = setTimeout(() => {
      lastSavedRef.current = value;
      onSaveRef.current(value);
    }, 1000);
    return () => clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    return () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); };
  }, []);

  const statusText = isSaving ? 'Saving…' : savedVisible ? 'Saved' : null;
  const opacityClass = statusText ? 'opacity-100' : 'opacity-0';
  const colorClass = savedVisible && !isSaving ? 'text-status-confirmed' : 'text-muted';

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Notes</h2>
        <span className={`text-xs transition-opacity duration-300 ${opacityClass} ${colorClass}`}>
          {statusText ?? 'Saved'}
        </span>
      </div>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add notes about this booking…"
        rows={5}
        className="resize-none text-sm"
      />
    </section>
  );
}
