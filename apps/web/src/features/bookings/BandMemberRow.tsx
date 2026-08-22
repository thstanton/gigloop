import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { IconButton } from '@/components/common/IconButton';
import { LabelValue } from '@/components/common/LabelValue';
import { StatusPill } from '@/components/common/StatusPill';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { GhostButton } from '@/components/common/GhostButton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BAND_MEMBER_STATUS_LABELS, BAND_MEMBER_STATUS_ORDER, BAND_MEMBER_STATUS_TOKENS } from '@/lib/constants';
import { formatFee } from '@/lib/formatters';
import { segmentLabel } from './BandAtom';
import type { BookingBandChair, BookingBandMember, BookingBandMemberStatus, BookingLineup, BookingPackageSummary } from '@/types/api';

// Band members v1 (#879, ADR-0072 §2/§3/§5, #885): one row per person on this gig — segment chips
// for every chair they fill, status, and their per-person fee. Presentational, same discipline as
// BandAtom: no fetch, no mutation, every edit signalled via a callback.

interface BandMemberRowProps {
  member: BookingBandMember;
  chairs: BookingBandChair[];
  lineups: BookingLineup[];
  packages: BookingPackageSummary[];
  onUnassignChair: (chairId: string) => void;
  onChangeStatus: (status: BookingBandMemberStatus) => void;
  isChangingStatus: boolean;
  onSaveFee: (sessionFee: number | null) => void;
  isSavingFee: boolean;
  onRemove: () => void;
  isRemoving: boolean;
}

export function BandMemberRow({
  member,
  chairs,
  lineups,
  packages,
  onUnassignChair,
  onChangeStatus,
  isChangingStatus,
  onSaveFee,
  isSavingFee,
  onRemove,
  isRemoving,
}: BandMemberRowProps) {
  const [editingFee, setEditingFee] = useState(false);
  const [feeInput, setFeeInput] = useState(member.sessionFee ?? '');
  const { tint, text, borderL } = BAND_MEMBER_STATUS_TOKENS[member.status];

  // Closes the editor once the save settles (success or failure), not synchronously on submit —
  // closing immediately would hide the "Saving…" state and, on failure, silently show the stale
  // value with only a toast as evidence anything went wrong.
  const wasSavingFee = useRef(isSavingFee);
  useEffect(() => {
    if (wasSavingFee.current && !isSavingFee) setEditingFee(false);
    wasSavingFee.current = isSavingFee;
  }, [isSavingFee]);

  function submitFee() {
    const trimmed = feeInput.trim();
    if (trimmed === '') return onSaveFee(null);
    const parsed = Number(trimmed);
    if (Number.isNaN(parsed)) return;
    onSaveFee(parsed);
  }

  return (
    <div className="py-3 border-b border-border last:border-b-0 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base font-medium text-foreground truncate">{member.contact.name}</span>
          {member.isSelf && <Badge variant="outline">You</Badge>}
        </div>
        <IconButton
          label="Remove member"
          onClick={onRemove}
          disabled={isRemoving}
          className="hover:text-status-cancelled"
        >
          <X size={16} />
        </IconButton>
      </div>

      {chairs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chairs.map((chair) => (
            <Badge key={chair.id} variant="outline" className="gap-1">
              {chair.role} · {segmentLabel(chair, lineups, packages)}
              <button
                type="button"
                aria-label={`Unassign ${chair.role}`}
                onClick={() => onUnassignChair(chair.id)}
                className="hover:text-status-cancelled"
              >
                <X size={12} />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <StatusPill label={BAND_MEMBER_STATUS_LABELS[member.status]} bg={tint} text={text} border={borderL} />
        <Select value={member.status} onValueChange={(v) => onChangeStatus(v as BookingBandMemberStatus)}>
          <SelectTrigger aria-label="Status" disabled={isChangingStatus} className="h-8 w-auto text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BAND_MEMBER_STATUS_ORDER.map((status) => (
              <SelectItem key={status} value={status}>{BAND_MEMBER_STATUS_LABELS[status]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <LabelValue label="Fee" className="py-0 border-0">
        {editingFee ? (
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              value={feeInput}
              onChange={(e) => setFeeInput(e.target.value)}
              placeholder="Fee"
              autoFocus
              className="h-8 w-24"
            />
            <GhostButton variant="primary" size="xs" onClick={submitFee} disabled={isSavingFee}>
              {isSavingFee ? 'Saving…' : 'Save'}
            </GhostButton>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { setFeeInput(member.sessionFee ?? ''); setEditingFee(true); }}
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            {formatFee(member.sessionFee) ?? 'Set fee'}
          </button>
        )}
      </LabelValue>
    </div>
  );
}
