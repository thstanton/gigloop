import { Textarea } from '@/components/ui/textarea';

// PRD #511 Module B / ADR-0053 / #548 — the shared Notes editor core. One controlled
// presentational textarea used by two surfaces: the self-saving Notes atom (InlineNotes, which
// wraps this with its debounce + Saving/Saved status) and the lean create form (which bubbles the
// value to the atomic POST via react-hook-form). It owns no save logic — value in, onChange out —
// so the "Notes" header and save-status chrome belong to each host, not the core. Sibling to
// DetailsFields / MusicFields / OverviewFields.

export function NotesField({
  value,
  onChange,
  rows = 5,
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Add notes about this booking…"
      rows={rows}
      className="resize-none text-sm"
    />
  );
}
