import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GhostButton } from '@/components/common/GhostButton';
import { ALL_GENRES, GENRE_LABELS } from '@/lib/constants';
import type { BookingPackageSummary, KeyMoment, MusicFormConfig } from '@/types/api';

// PRD #511 Module B — the Music atom: the presentational editor of a booking's
// MusicFormConfig (enabled genres + key moments grouped by package). The on/off
// state is derived from `hasMusicFormConfig`; ADR-0046 treats config-row *presence*
// as the truth — turn-on creates the row, turn-off deletes it.
//
// Sheet-agnostic: owns no fetch and no mutation. It emits the user's intent via
// `onSave`, `onTurnOn`, and `onTurnOff` and renders host-injected Tier-1 save state.
// The same atom works in the self-saving QuickTweakSheet and in the Builder page.

export interface MusicAtomSavePayload {
  keyMoments: KeyMoment[];
  enabledGenres: string[];
}

export interface MusicAtomProps {
  hasMusicFormConfig: boolean;
  /** null when hasMusicFormConfig=true but the config query hasn't settled; atom shows skeleton. */
  config: MusicFormConfig | null;
  packages: BookingPackageSummary[];
  onSave: (payload: MusicAtomSavePayload) => void;
  onTurnOn: () => void;
  onTurnOff: () => void;
  // Tier-1 save state injected by the host.
  isSaving: boolean;
  saved: boolean;
  saveError: string | null;
  isTurningOn: boolean;
  isTurningOff: boolean;
}

function renderTurnOffControl({
  confirmRemove,
  isSaving,
  isTurningOff,
  onConfirm,
  onCancel,
  onTurnOff,
}: {
  confirmRemove: boolean;
  isSaving: boolean;
  isTurningOff: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onTurnOff: () => void;
}) {
  if (isTurningOff) {
    return (
      <Button size="sm" variant="ghost" disabled className="text-status-cancelled">
        Removing…
      </Button>
    );
  }
  if (confirmRemove) {
    return (
      <>
        <Button size="sm" variant="destructive" onClick={onTurnOff}>Yes, remove</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </>
    );
  }
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={onConfirm}
      disabled={isSaving}
      className="text-status-cancelled hover:text-status-cancelled/80"
    >
      <Trash2 size={14} className="mr-1" />
      Remove music form
    </Button>
  );
}

export function MusicAtom({
  hasMusicFormConfig,
  config,
  packages,
  onSave,
  onTurnOn,
  onTurnOff,
  isSaving,
  saved,
  saveError,
  isTurningOn,
  isTurningOff,
}: MusicAtomProps) {
  // Initialised once from config at mount. The atom does not re-sync from props so that
  // an in-progress edit is not clobbered by a background refetch (same invariant as DetailsAtom).
  const [localKeyMoments, setLocalKeyMoments] = useState<KeyMoment[]>(() => config?.keyMoments ?? []);
  const [localGenres, setLocalGenres] = useState<string[]>(() => config?.enabledGenres ?? []);
  const [confirmRemove, setConfirmRemove] = useState(false);

  // Off == no config row (ADR-0046). Show an explicit turn-on control so an off form can't be
  // mistaken for an on-but-empty form.
  if (!hasMusicFormConfig) {
    return (
      <div>
        <p className="text-sm text-muted mb-3">
          The music form is off — the customer won't be asked for song requests for this booking.
        </p>
        <Button size="sm" onClick={onTurnOn} disabled={isTurningOn}>
          <Plus size={14} className="mr-1" />
          {isTurningOn ? 'Turning on…' : 'Turn on music form'}
        </Button>
      </div>
    );
  }

  // On, config still loading.
  if (!config) {
    return <div className="h-16 bg-border rounded animate-pulse" />;
  }

  // Section options are the booking's package labels (de-duped) + "Other". A moment's own
  // section stays selectable even if stale (e.g. package renamed after the moment was created).
  const sectionOptions = Array.from(new Set([...packages.map((p) => p.label), 'Other']));

  function toggleGenre(genre: string) {
    setLocalGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
    );
  }

  const hasChanges =
    JSON.stringify({ keyMoments: localKeyMoments, enabledGenres: localGenres }) !==
    JSON.stringify({ keyMoments: config.keyMoments, enabledGenres: config.enabledGenres });

  function handleSave() {
    onSave({
      keyMoments: localKeyMoments
        .filter((km) => km.label.trim())
        .map((km) => ({ label: km.label.trim(), section: km.section })),
      enabledGenres: localGenres,
    });
  }

  return (
    <div className="space-y-4">

      {/* Key moments */}
      <div>
        <p className="text-xs font-medium text-muted mb-2">Key moments</p>
        {localKeyMoments.length === 0 ? (
          <p className="text-sm text-muted mb-2">No key moments yet.</p>
        ) : (
          <div className="space-y-1 mb-2">
            {localKeyMoments.map((km, i) => {
              const opts = sectionOptions.includes(km.section)
                ? sectionOptions
                : [...sectionOptions, km.section];
              return (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={km.label}
                    placeholder="Key moment"
                    onChange={(e) =>
                      setLocalKeyMoments((prev) =>
                        prev.map((m, j) => (j === i ? { ...m, label: e.target.value } : m)),
                      )
                    }
                    className="flex-1 min-w-0 text-sm bg-background border border-border rounded px-2 py-1"
                    aria-label="Key moment label"
                  />
                  <select
                    value={km.section}
                    onChange={(e) =>
                      setLocalKeyMoments((prev) =>
                        prev.map((m, j) => (j === i ? { ...m, section: e.target.value } : m)),
                      )
                    }
                    className="text-sm bg-background border border-border rounded px-2 py-1"
                    aria-label="Key moment section"
                  >
                    {opts.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setLocalKeyMoments((prev) => prev.filter((_, j) => j !== i))}
                    className="text-muted hover:text-status-cancelled transition-colors flex-shrink-0"
                    aria-label="Remove key moment"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <GhostButton
          onClick={() =>
            setLocalKeyMoments((prev) => [
              ...prev,
              { label: '', section: 'Other' },
            ])
          }
          variant="primary"
          size="xs"
          icon={<Plus size={12} aria-hidden="true" />}
        >
          Add key moment
        </GhostButton>
      </div>

      {/* Genres */}
      <div>
        <p className="text-xs font-medium text-muted mb-2">Enabled genres</p>
        <div className="flex flex-wrap gap-2">
          {ALL_GENRES.map((genre) => {
            const active = localGenres.includes(genre);
            return (
              <button
                key={genre}
                type="button"
                onClick={() => toggleGenre(genre)}
                className={`inline-flex items-center px-3 py-1 rounded-full border text-sm transition-colors ${
                  active
                    ? 'border-primary text-primary bg-primary/8'
                    : 'border-border text-muted hover:border-primary'
                }`}
              >
                {GENRE_LABELS[genre as keyof typeof GENRE_LABELS] ?? genre}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tier-1 save + turn-off */}
      <div className="flex items-center gap-3 pt-1 flex-wrap">
        <Button size="sm" onClick={handleSave} disabled={isSaving || isTurningOff || !hasChanges}>
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
        {saved && !isSaving && !confirmRemove && (
          <span className="text-xs text-muted">Saved</span>
        )}
        {saveError && <p className="text-sm text-status-cancelled">{saveError}</p>}

        {renderTurnOffControl({
          confirmRemove,
          isSaving,
          isTurningOff,
          onConfirm: () => setConfirmRemove(true),
          onCancel: () => setConfirmRemove(false),
          onTurnOff: () => { setConfirmRemove(false); onTurnOff(); },
        })}
      </div>
    </div>
  );
}
