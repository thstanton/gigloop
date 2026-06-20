import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { DEFAULT_ENABLED_GENRES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { GenrePills, SpecialRequestsEditor } from './MusicFields';
import type { BookingPackageSummary, KeyMoment, MusicFormConfig } from '@/types/api';

// PRD #511 Module B / #535 — the Music atom: the presentational editor of a booking's
// MusicFormConfig (genres + "special requests" grouped by package). On/off is a single Switch;
// ADR-0046 treats config-row *presence* as the truth — turn-on creates the row (seeding default
// genres so the client's song list isn't tab-less), turn-off deletes it. The editor is always
// visible below the Switch; when off it is dimmed and previews the defaults turn-on will create.
//
// Sheet-agnostic: owns no fetch and no mutation. It emits the user's intent via `onSave`,
// `onTurnOn`, and `onTurnOff` and renders host-injected Tier-1 save state. The same atom works in
// the self-saving QuickTweakSheet and in the Builder page.

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

const serialize = (c: { keyMoments: KeyMoment[]; enabledGenres: string[] }) =>
  JSON.stringify({ keyMoments: c.keyMoments, enabledGenres: c.enabledGenres });

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
  const on = hasMusicFormConfig;

  const [localKeyMoments, setLocalKeyMoments] = useState<KeyMoment[]>(() => config?.keyMoments ?? []);
  const [localGenres, setLocalGenres] = useState<string[]>(() => config?.enabledGenres ?? []);
  const [confirmOff, setConfirmOff] = useState(false);

  // Gap D (#535): re-sync local state from `config` when the config changes — but only when the
  // atom isn't dirty, so the accept-suggestion path (config A → A+B) lands while a genuine mid-edit
  // is never clobbered. `lastSyncedRef` holds the config snapshot the local state last matched;
  // local !== that snapshot means the user has unsaved edits (same ref pattern as SetRow).
  const lastSyncedRef = useRef<string | null>(config ? serialize(config) : null);
  useEffect(() => {
    if (!config) return;
    const incoming = serialize(config);
    if (lastSyncedRef.current === null) {
      setLocalKeyMoments(config.keyMoments);
      setLocalGenres(config.enabledGenres);
      lastSyncedRef.current = incoming;
      return;
    }
    if (incoming === lastSyncedRef.current) return;
    const localSnapshot = serialize({ keyMoments: localKeyMoments, enabledGenres: localGenres });
    if (localSnapshot === lastSyncedRef.current) {
      setLocalKeyMoments(config.keyMoments);
      setLocalGenres(config.enabledGenres);
    }
    lastSyncedRef.current = incoming;
  }, [config, localKeyMoments, localGenres]);

  // On, config still loading: skeleton (off renders the preview immediately).
  if (on && !config) {
    return <div className="h-16 bg-border rounded animate-pulse" />;
  }

  // What the editor shows: live config when on; the turn-on defaults preview when off.
  const displayGenres = on ? localGenres : (DEFAULT_ENABLED_GENRES as string[]);
  const displayMoments = on ? localKeyMoments : [];

  // Grouping options: the booking's package labels + "Other", plus any stale section a moment still
  // carries (e.g. a package renamed after the moment was created) so it stays visible/editable.
  const sectionOptions = Array.from(new Set([...packages.map((p) => p.label), 'Other']));
  const extraSections = Array.from(
    new Set(displayMoments.map((km) => km.section).filter((s) => !sectionOptions.includes(s))),
  );
  const groups = [...sectionOptions, ...extraSections];
  const grouped = packages.length > 0;
  const hasRequests = localKeyMoments.some((km) => km.label.trim());

  const hasChanges = on && config != null && serialize({ keyMoments: localKeyMoments, enabledGenres: localGenres }) !== serialize(config);

  function toggleGenre(genre: string) {
    setLocalGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
    );
  }

  function addMoment(section: string) {
    setLocalKeyMoments((prev) => [...prev, { label: '', section }]);
  }

  function updateMoment(index: number, patch: Partial<KeyMoment>) {
    setLocalKeyMoments((prev) => prev.map((m, j) => (j === index ? { ...m, ...patch } : m)));
  }

  function removeMoment(index: number) {
    setLocalKeyMoments((prev) => prev.filter((_, j) => j !== index));
  }

  function handleSave() {
    onSave({
      keyMoments: localKeyMoments
        .filter((km) => km.label.trim())
        .map((km) => ({ label: km.label.trim(), section: km.section })),
      enabledGenres: localGenres,
    });
  }

  // The Switch stays visually ON until an off is confirmed — so a cancelled turn-off can't flip it.
  function handleSwitch(next: boolean) {
    if (next) {
      onTurnOn();
      return;
    }
    if (hasRequests) setConfirmOff(true);
    else onTurnOff();
  }

  return (
    <div className="space-y-5">
      {/* On/off Switch */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-medium text-foreground">Music form</p>
          <p className="text-sm text-muted">
            Collect song requests from your client for this booking.
          </p>
        </div>
        <Switch
          checked={on}
          onCheckedChange={handleSwitch}
          disabled={isTurningOn || isTurningOff}
          aria-label="Music form"
        />
      </div>

      {confirmOff && (
        <div className="rounded-md border border-border bg-surface p-3">
          <p className="text-sm text-foreground">
            Turning off deletes the special requests you've added. Turn off the music form?
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Button size="sm" variant="destructive" disabled={isTurningOff} onClick={() => { setConfirmOff(false); onTurnOff(); }}>
              {isTurningOff ? 'Turning off…' : 'Yes, turn off'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmOff(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <Separator />

      {/* Editor — dimmed and inert when off (controls are disabled), previewing the defaults
          turn-on will create. */}
      <div className={cn('space-y-6', !on && 'opacity-50 pointer-events-none select-none')}>
        {/* Genres first — the fundamental thing, matching the portal's section order. */}
        <div>
          <p className="text-sm font-medium text-foreground">Genres</p>
          <p className="mt-1 mb-3 text-sm text-muted">
            The genres your client can browse when choosing songs from your library.
          </p>
          <GenrePills selected={displayGenres} disabled={!on} onToggle={toggleGenre} />
        </div>

        {/* Special requests — grouped by booking package (echoing the Itinerary atom). */}
        <div>
          <p className="text-sm font-medium text-foreground">Special requests</p>
          <p className="mt-1 mb-3 text-sm text-muted">
            Add the moments that call for a specific song — first dance, cake cutting, last song.
            Your client chooses the song for each.
          </p>
          <SpecialRequestsEditor
            moments={displayMoments}
            groups={groups}
            grouped={grouped}
            onAdd={addMoment}
            onUpdate={updateMoment}
            onRemove={removeMoment}
          />
        </div>

        {/* Tier-1 save (only meaningful when on). */}
        {on && (
          <div className="flex items-center gap-3 pt-1 flex-wrap">
            <Button size="sm" onClick={handleSave} disabled={isSaving || !hasChanges}>
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
            {saved && !isSaving && <span className="text-xs text-muted">Saved</span>}
            {saveError && <p className="text-sm text-status-cancelled">{saveError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
