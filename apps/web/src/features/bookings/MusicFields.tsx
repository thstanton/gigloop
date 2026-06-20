import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { GhostButton } from '@/components/common/GhostButton';
import { ALL_GENRES, GENRE_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { KeyMoment } from '@/types/api';

// PRD #511 Module B / #535 — presentational primitives for the Music atom: the genre pill
// multi-select and the special-requests editor (grouped by booking package, echoing the Itinerary
// atom). These own NO mutation and NO fetch — controlled state in, intent out via callbacks. The
// atom composes them; the host shell turns the callbacks into persistence. Sibling to
// ItineraryFields / DetailsFields.

export function GenrePills({
  selected,
  disabled,
  onToggle,
}: {
  selected: string[];
  disabled: boolean;
  onToggle: (genre: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {ALL_GENRES.map((genre) => {
        const active = selected.includes(genre);
        return (
          <button
            key={genre}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(genre)}
            className={cn(
              'inline-flex items-center px-3 py-1 rounded-full border text-sm transition-colors',
              active
                ? 'border-primary text-primary bg-primary/8'
                : 'border-border text-muted hover:border-primary',
            )}
          >
            {GENRE_LABELS[genre as keyof typeof GENRE_LABELS] ?? genre}
          </button>
        );
      })}
    </div>
  );
}

// ─── One special-request row: label input + optional move control + remove ──────────

function MomentRow({
  moment,
  sectionOptions,
  onLabel,
  onSection,
  onRemove,
}: {
  moment: KeyMoment;
  /** null → no packages, so no move control (single "Other" group). */
  sectionOptions: string[] | null;
  onLabel: (label: string) => void;
  onSection: (section: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        value={moment.label}
        placeholder="e.g. First dance"
        onChange={(e) => onLabel(e.target.value)}
        aria-label="Special request"
        className="flex-1 min-w-0"
      />
      {sectionOptions && (
        <select
          value={moment.section}
          onChange={(e) => onSection(e.target.value)}
          aria-label="Special request group"
          className="h-10 rounded-md border border-border bg-background px-2 text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {sectionOptions.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove special request"
        className="flex-shrink-0 p-1 text-muted transition-colors hover:text-status-cancelled"
      >
        <Trash2 size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

function AddRequestButton({ onClick }: { onClick: () => void }) {
  return (
    <GhostButton
      onClick={onClick}
      variant="primary"
      size="xs"
      icon={<Plus size={12} aria-hidden="true" />}
      className="mt-1.5"
    >
      Add request
    </GhostButton>
  );
}

/** The special-requests editor: one group per booking package + "Other" when packages exist,
 *  otherwise a single flat list (everything under "Other", no move control). Rows are addressed by
 *  their index in the flat `moments` array — the atom owns that array as its save payload. */
export function SpecialRequestsEditor({
  moments,
  groups,
  grouped,
  onAdd,
  onUpdate,
  onRemove,
}: {
  moments: KeyMoment[];
  groups: string[];
  grouped: boolean;
  onAdd: (section: string) => void;
  onUpdate: (index: number, patch: Partial<KeyMoment>) => void;
  onRemove: (index: number) => void;
}) {
  if (!grouped) {
    return (
      <div className="space-y-1.5">
        {moments.length === 0 ? (
          <p className="text-sm text-muted">No special requests yet.</p>
        ) : (
          moments.map((km, i) => (
            <MomentRow
              key={i}
              moment={km}
              sectionOptions={null}
              onLabel={(label) => onUpdate(i, { label })}
              onSection={() => {}}
              onRemove={() => onRemove(i)}
            />
          ))
        )}
        <AddRequestButton onClick={() => onAdd('Other')} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((section) => {
        const rows = moments.map((km, i) => ({ km, i })).filter((r) => r.km.section === section);
        return (
          <div key={section}>
            <p className="mb-1.5 text-sm font-medium text-foreground">{section}</p>
            <div className="space-y-1.5">
              {rows.length === 0 ? (
                <p className="text-sm text-muted">None yet.</p>
              ) : (
                rows.map(({ km, i }) => (
                  <MomentRow
                    key={i}
                    moment={km}
                    sectionOptions={groups}
                    onLabel={(label) => onUpdate(i, { label })}
                    onSection={(s) => onUpdate(i, { section: s })}
                    onRemove={() => onRemove(i)}
                  />
                ))
              )}
            </div>
            <AddRequestButton onClick={() => onAdd(section)} />
          </div>
        );
      })}
    </div>
  );
}
