import { useState } from 'react';
import { ChevronDown, ChevronUp, Users, X } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { GhostButton } from '@/components/common/GhostButton';
import { IconButton } from '@/components/common/IconButton';
import { FormField } from '@/components/common/FormField';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { BookingBandChair, BookingPackageSummary, LineupTemplate } from '@/types/api';

// Band members v1 (#879, ADR-0072 §2/§3, #884). Presentational: no fetch, no mutation — the host
// (BandSheet) wires every action via a callback. This slice's Band sheet renders the unfilled-chair
// block only; per-member rows arrive in #885.

const WHOLE_DAY = '__whole_day__';

function segmentLabel(chair: BookingBandChair, packages: BookingPackageSummary[]): string {
  if (!chair.packageId) return 'Whole day';
  return packages.find((p) => p.id === chair.packageId)?.label ?? 'Whole day';
}

interface BandAtomProps {
  chairs: BookingBandChair[];
  packages: BookingPackageSummary[];
  lineupTemplates: LineupTemplate[];
  lineupTemplatesLoading: boolean;
  onApplyLineup: (lineupTemplateId: string, packageId: string | null) => void;
  isApplyingLineup: boolean;
  onAddChair: (role: string, packageId: string | null) => void;
  isAddingChair: boolean;
  onRemoveChair: (chairId: string) => void;
  removingChairId: string | null;
  onMoveChair: (chairId: string, direction: 'up' | 'down') => void;
}

function SegmentPicker({
  packages,
  value,
  onChange,
}: {
  packages: BookingPackageSummary[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <FormField label="Segment">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label="Segment">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={WHOLE_DAY}>Whole day</SelectItem>
          {packages.map((pkg) => (
            <SelectItem key={pkg.id} value={pkg.id}>{pkg.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}

function ChairRow({
  chair,
  packages,
  onRemove,
  isRemoving,
  onMove,
  canMoveUp,
  canMoveDown,
}: {
  chair: BookingBandChair;
  packages: BookingPackageSummary[];
  onRemove: () => void;
  isRemoving: boolean;
  onMove: (direction: 'up' | 'down') => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  return (
    <div className="flex items-center gap-2 py-2 border-b border-border last:border-b-0">
      <div className="flex flex-col">
        <IconButton label="Move up" onClick={() => onMove('up')} disabled={!canMoveUp} className="min-h-0 min-w-0 h-4">
          <ChevronUp size={14} />
        </IconButton>
        <IconButton label="Move down" onClick={() => onMove('down')} disabled={!canMoveDown} className="min-h-0 min-w-0 h-4">
          <ChevronDown size={14} />
        </IconButton>
      </div>
      <Badge variant="outline">{chair.role}</Badge>
      <span className="flex-1 text-sm text-muted">{segmentLabel(chair, packages)}</span>
      {chair.callTime && <span className="text-sm tabular-nums text-muted">{chair.callTime}</span>}
      <IconButton
        label="Remove chair"
        onClick={onRemove}
        disabled={isRemoving}
        className="hover:text-status-cancelled"
      >
        <X size={16} />
      </IconButton>
    </div>
  );
}

export function BandAtom({
  chairs,
  packages,
  lineupTemplates,
  lineupTemplatesLoading,
  onApplyLineup,
  isApplyingLineup,
  onAddChair,
  isAddingChair,
  onRemoveChair,
  removingChairId,
  onMoveChair,
}: BandAtomProps) {
  const [segment, setSegment] = useState<string>(WHOLE_DAY);
  const [addingRole, setAddingRole] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const targetPackageId = segment === WHOLE_DAY ? null : segment;
  const sortedChairs = [...chairs].sort((a, b) => a.order - b.order);

  function submitAddChair() {
    if (!addingRole.trim()) return;
    onAddChair(addingRole.trim(), targetPackageId);
    setAddingRole('');
    setAddOpen(false);
  }

  return (
    <div className="space-y-4">
      {packages.length > 0 && <SegmentPicker packages={packages} value={segment} onChange={setSegment} />}

      {lineupTemplates.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Apply a lineup</p>
          <div className="flex flex-wrap gap-2">
            {lineupTemplates.map((lineup) => (
              <button
                key={lineup.id}
                type="button"
                disabled={isApplyingLineup}
                onClick={() => onApplyLineup(lineup.id, targetPackageId)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm transition-colors hover:border-primary disabled:opacity-50"
              >
                {lineup.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {lineupTemplatesLoading && <p className="text-sm text-muted">Loading lineups…</p>}

      {sortedChairs.length === 0 && !addOpen && (
        <EmptyState
          icon={<Users size={24} />}
          heading="No band yet"
          description="Apply a lineup, or add chairs one at a time."
          action={
            <GhostButton variant="primary" size="xs" onClick={() => setAddOpen(true)}>
              Add a chair
            </GhostButton>
          }
        />
      )}

      {sortedChairs.length > 0 && (
        <Card title="Chairs to fill">
          <div>
            {sortedChairs.map((chair, i) => (
              <ChairRow
                key={chair.id}
                chair={chair}
                packages={packages}
                onRemove={() => onRemoveChair(chair.id)}
                isRemoving={removingChairId === chair.id}
                onMove={(direction) => onMoveChair(chair.id, direction)}
                canMoveUp={i > 0}
                canMoveDown={i < sortedChairs.length - 1}
              />
            ))}
          </div>
        </Card>
      )}

      {sortedChairs.length > 0 && !addOpen && (
        <GhostButton variant="primary" size="xs" onClick={() => setAddOpen(true)}>
          + Add chair
        </GhostButton>
      )}

      {addOpen && (
        <div className="flex items-end gap-2">
          <FormField label="Role" className="flex-1">
            <Input
              value={addingRole}
              onChange={(e) => setAddingRole(e.target.value)}
              placeholder="e.g. Saxophone"
              autoFocus
            />
          </FormField>
          <GhostButton
            variant="primary"
            size="sm"
            onClick={submitAddChair}
            disabled={!addingRole.trim() || isAddingChair}
            className="mb-0.5"
          >
            {isAddingChair ? 'Adding…' : 'Add'}
          </GhostButton>
        </div>
      )}
    </div>
  );
}
