import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GhostButton } from '@/components/common/GhostButton';
import { SubLabel } from '@/components/common/SubLabel';
import { LOGISTICS_ANCHOR_FIELDS, type LogisticsAnchorKey } from '@/lib/constants';
import {
  AddSetForm,
  AnchorRow,
  NO_PACKAGE,
  PackageBoxHeader,
  SetRow,
  TemplatePicker,
  anchorEntryFrom,
  buildAnchorSlice,
  draftToValues,
  emptySetDraft,
  orderTimelineSets,
  type AnchorEntry,
  type PackageOption,
  type SetDraft,
  type SetValues,
} from './ItineraryFields';
import type {
  BookingLogisticsEntry,
  BookingPackageSummary,
  PackageTemplate,
  PerformanceSet,
} from '@/types/api';

// PRD #511 Module B — the Itinerary atom (ADR-0050): the single admin surface for a booking's
// running order. It unifies the old PerformanceEditor (sets + the packages that group them) and the
// time-anchor half of OnTheDayEditor into one surface, and retires the "Performance" concept.
//
// Two backing stores behind one surface (an internal seam): sets/packages are server rows; the three
// time anchors live in the `logistics` JSON (ADR-0034). Like the Venue/People/Details atoms it owns
// NO mutation and NO fetch. Row operations (add/edit/delete/re-parent set, package CRUD, apply
// template) are immediate-persist and signalled via callbacks; the host shell owns those mutations
// and fetches the templates. The anchors mirror the Details atom: a controlled Tier-1 slice emitted
// via onSaveAnchors — the host merges it OVER the preserved non-temporal Details keys before PATCH
// (the inverse of the Details merge; a wholesale logistics write would otherwise wipe the anchors).
//
// Layout (settled via the #521 prototype): a Times block on top, then the running order as one box
// per package PLUS an "ungrouped" box — each box holds collapsed set rows (expand to edit), a
// persistent add-set form, and (for packages) an editable name/icon header. Sets re-parent via a
// dropdown in the expanded row; start time orders them within a box.

type AnchorDraft = Record<LogisticsAnchorKey, AnchorEntry>;

function buildAnchorDraft(logistics: Record<string, BookingLogisticsEntry> | null): AnchorDraft {
  return {
    arrivalTime: anchorEntryFrom(logistics, 'arrivalTime'),
    soundCheckTime: anchorEntryFrom(logistics, 'soundCheckTime'),
    finishTime: anchorEntryFrom(logistics, 'finishTime'),
  };
}

export interface ItineraryAtomProps {
  sets: PerformanceSet[];
  packages: BookingPackageSummary[];
  /** The booking's current logistics — the atom reads only its three time-anchor keys. */
  initialLogistics: Record<string, BookingLogisticsEntry> | null;
  /** Drives template matching/ordering (event-type templates lead). */
  eventType: string;
  templates: PackageTemplate[];
  templatesLoading: boolean;

  // Row operations — immediate-persist; the host owns the mutations.
  onAddSet: (packageId: string | null, values: SetValues) => void;
  onUpdateSet: (setId: string, values: SetValues) => void;
  onDeleteSet: (setId: string) => void;
  /** Re-parent: packageId is the target package, or null to move the set to ungrouped. */
  onMoveSet: (setId: string, packageId: string | null) => void;
  onApplyTemplate: (templateId: string) => void;
  onUpdatePackage: (packageId: string, dto: { label?: string; icon?: string }) => void;
  onRemovePackage: (packageId: string) => void;

  // Anchors — controlled Tier-1 slice; the host does the inverse logistics merge.
  onSaveAnchors: (anchors: Record<string, BookingLogisticsEntry>) => void;

  // Coarse loading/feedback (one row/box interacts at a time).
  savingSetId?: string | null;
  deletingSetId?: string | null;
  movingSetId?: string | null;
  /** The box key (a package id, or NO_PACKAGE) currently persisting an add. */
  addingKey?: string | null;
  isApplyingTemplate?: boolean;
  removingPackageId?: string | null;
  anchorsSaving?: boolean;
  anchorsSaved?: boolean;
  anchorsError?: string | null;
}

export function ItineraryAtom({
  sets,
  packages,
  initialLogistics,
  eventType,
  templates,
  templatesLoading,
  onAddSet,
  onUpdateSet,
  onDeleteSet,
  onMoveSet,
  onApplyTemplate,
  onUpdatePackage,
  onRemovePackage,
  onSaveAnchors,
  savingSetId = null,
  deletingSetId = null,
  movingSetId = null,
  addingKey = null,
  isApplyingTemplate = false,
  removingPackageId = null,
  anchorsSaving = false,
  anchorsSaved = false,
  anchorsError = null,
}: ItineraryAtomProps) {
  // Self-initialized once (Venue/People/Details style): the post-save ['booking'] refetch must not
  // stomp an in-progress anchor edit while a self-saving shell stays open.
  const [anchors, setAnchors] = useState<AnchorDraft>(() => buildAnchorDraft(initialLogistics));
  const [addOpen, setAddOpen] = useState(false);

  const anchorsInitial = JSON.stringify(buildAnchorSlice(buildAnchorDraft(initialLogistics), initialLogistics));
  const anchorsPayload = buildAnchorSlice(anchors, initialLogistics);
  const anchorsDirty = JSON.stringify(anchorsPayload) !== anchorsInitial;

  function setAnchor(key: LogisticsAnchorKey, patch: Partial<AnchorEntry>) {
    setAnchors((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  // Re-parent targets: every package plus "No package".
  const packageOptions: PackageOption[] = [
    ...packages.map((p) => ({ value: p.id, label: p.label })),
    { value: NO_PACKAGE, label: 'No package' },
  ];

  // Sets grouped under their package; ungrouped collected separately. Within a box the timeline
  // order drives the sequence.
  const setsByPackageId = new Map<string, PerformanceSet[]>();
  for (const set of sets) {
    if (!set.packageId) continue;
    if (!setsByPackageId.has(set.packageId)) setsByPackageId.set(set.packageId, []);
    setsByPackageId.get(set.packageId)!.push(set);
  }
  const ungroupedSets = orderTimelineSets(sets.filter((s) => !s.packageId), packages);

  const rowLoading = (setId: string) => ({
    isSaving: savingSetId === setId,
    isDeleting: deletingSetId === setId,
    isMoving: movingSetId === setId,
  });

  return (
    <div className="space-y-8">
      {/* ── Times: the three operational anchors (logistics JSON) ─────────────── */}
      <section className="space-y-4">
        <SubLabel>Times</SubLabel>
        <div className="space-y-5">
          {LOGISTICS_ANCHOR_FIELDS.map(({ key, label }) => (
            <AnchorRow key={key} anchorKey={key} label={label} entry={anchors[key]} onChange={(patch) => setAnchor(key, patch)} />
          ))}
        </div>
        {/* Tier-1 inline save (CLAUDE.md Loading & Feedback). */}
        <div className="flex items-center gap-3">
          <Button type="button" size="sm" onClick={() => onSaveAnchors(anchorsPayload)} disabled={anchorsSaving || !anchorsDirty}>
            {anchorsSaving ? 'Saving…' : 'Save times'}
          </Button>
          {anchorsSaved && !anchorsSaving && <span className="text-xs text-muted">Saved</span>}
          {anchorsError && <p className="text-sm text-status-cancelled">{anchorsError}</p>}
        </div>
      </section>

      {/* ── Running order: one box per package + an ungrouped box ──────────────── */}
      <section className="space-y-3">
        <SubLabel>Running order</SubLabel>

        {packages.map((pkg) => (
          <ItinerarySetBox
            key={pkg.id}
            pkg={pkg}
            sets={orderTimelineSets(setsByPackageId.get(pkg.id) ?? [], packages)}
            packageOptions={packageOptions}
            isAdding={addingKey === pkg.id}
            removingPackageId={removingPackageId}
            rowLoading={rowLoading}
            onAddSet={(values) => onAddSet(pkg.id, values)}
            onUpdateSet={onUpdateSet}
            onDeleteSet={onDeleteSet}
            onMoveSet={onMoveSet}
            onUpdatePackage={(dto) => onUpdatePackage(pkg.id, dto)}
            onRemovePackage={() => onRemovePackage(pkg.id)}
          />
        ))}

        <ItinerarySetBox
          pkg={null}
          sets={ungroupedSets}
          packageOptions={packageOptions}
          isAdding={addingKey === NO_PACKAGE}
          removingPackageId={removingPackageId}
          rowLoading={rowLoading}
          onAddSet={(values) => onAddSet(null, values)}
          onUpdateSet={onUpdateSet}
          onDeleteSet={onDeleteSet}
          onMoveSet={onMoveSet}
        />

        {addOpen ? (
          <TemplatePicker
            templates={templates}
            templatesLoading={templatesLoading}
            eventType={eventType}
            isApplying={isApplyingTemplate}
            onApply={(templateId) => { onApplyTemplate(templateId); setAddOpen(false); }}
            onCancel={() => setAddOpen(false)}
          />
        ) : (
          <GhostButton onClick={() => setAddOpen(true)} variant="primary" icon={<Plus size={14} aria-hidden="true" />}>
            Add package
          </GhostButton>
        )}
      </section>
    </div>
  );
}

// ─── A running-order box: package header (or "No package") + rows + add form ──────

function ItinerarySetBox({
  pkg,
  sets,
  packageOptions,
  isAdding,
  removingPackageId,
  rowLoading,
  onAddSet,
  onUpdateSet,
  onDeleteSet,
  onMoveSet,
  onUpdatePackage,
  onRemovePackage,
}: {
  pkg: BookingPackageSummary | null;
  sets: PerformanceSet[];
  packageOptions: PackageOption[];
  isAdding: boolean;
  removingPackageId: string | null;
  rowLoading: (setId: string) => { isSaving: boolean; isDeleting: boolean; isMoving: boolean };
  onAddSet: (values: SetValues) => void;
  onUpdateSet: (setId: string, values: SetValues) => void;
  onDeleteSet: (setId: string) => void;
  onMoveSet: (setId: string, packageId: string | null) => void;
  onUpdatePackage?: (dto: { label?: string; icon?: string }) => void;
  onRemovePackage?: () => void;
}) {
  // UI-only draft for this box's persistent add form; copy prefills it (minus time).
  const [draft, setDraft] = useState<SetDraft>(emptySetDraft);
  const labelRef = useRef<HTMLInputElement>(null);

  function copyFrom(set: PerformanceSet) {
    setDraft({ label: set.label ?? '', duration: set.duration.toString(), startTime: '' });
    requestAnimationFrame(() => labelRef.current?.focus());
  }

  function add() {
    onAddSet(draftToValues(draft));
    setDraft(emptySetDraft);
    requestAnimationFrame(() => labelRef.current?.focus());
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      {pkg && onUpdatePackage && onRemovePackage ? (
        <PackageBoxHeader
          pkg={pkg}
          setCount={sets.length}
          isRemoving={removingPackageId === pkg.id}
          onUpdate={onUpdatePackage}
          onRemove={onRemovePackage}
        />
      ) : (
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-muted">No package</span>
          <span className="text-xs text-muted">{sets.length} {sets.length === 1 ? 'set' : 'sets'}</span>
        </div>
      )}

      <div className="space-y-2">
        {sets.map((set) => {
          const { isSaving, isDeleting, isMoving } = rowLoading(set.id);
          return (
            <SetRow
              key={set.id}
              set={set}
              packageOptions={packageOptions}
              isSaving={isSaving}
              isDeleting={isDeleting}
              isMoving={isMoving}
              onCommit={(values) => onUpdateSet(set.id, values)}
              onMove={(target) => onMoveSet(set.id, target === NO_PACKAGE ? null : target)}
              onCopy={() => copyFrom(set)}
              onDelete={() => onDeleteSet(set.id)}
            />
          );
        })}
        {sets.length === 0 && <p className="px-1 py-1 text-xs text-muted">No sets in this group yet.</p>}
      </div>

      <AddSetForm
        draft={draft}
        labelRef={labelRef}
        isAdding={isAdding}
        onChange={setDraft}
        onAdd={add}
        onClear={() => setDraft(emptySetDraft)}
      />
    </div>
  );
}
