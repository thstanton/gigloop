import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { GhostButton } from '@/components/common/GhostButton';
import { IconButton } from '@/components/common/IconButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDatalistId } from '@/lib/hooks/useDatalistId';
import ContactPicker from './ContactPicker';
import { PartRow } from './PartRow';
import { callTimeParts, lineupName, shouldNameBand } from './bandParts';
import type { BookingBandChair, BookingLineup, Contact } from '@/types/api';

// #983's resolution, card 3 of 3. The SAME part row as the Players card — identical markup — which
// is how the vacancy/member symmetry is answered: one component used twice, not two blocks made to
// resemble each other. Always present; when nothing is empty it says so rather than disappearing,
// because "every part is filled" is a fact the musician wants confirmed.

interface PartsToFillCardProps {
  vacantChairs: BookingBandChair[];
  lineups: BookingLineup[];
  /** Whether the booking has any packages — `callTimeParts`' discriminator for the package-less
   *  bucket ("Whole gig" versus a band parked with nothing to play yet, ADR-0081 §4). */
  hasPackages: boolean;
  venue: Contact | null;
  instrumentVocabulary: string[];
  onAssignChair: (chairId: string, contactId: string | null) => void;
  assigningChairId: string | null;
  onAddPart: (role: string, lineupId: string | null) => void;
  isAddingPart: boolean;
  /** A part added by mistake has to be removable — the row's one action when nobody plays it. */
  onRemovePart: (chairId: string) => void;
  removingPartId: string | null;
}

/**
 * `+ Add a part` and its inline form. Exported because BandAtom's empty state offers the same
 * action: it must ASK for the role, not invent one — it previously added a part called "Vocals"
 * the musician never named.
 */
export function AddPartFooter({
  lineups,
  instrumentVocabulary,
  onAddPart,
  isAddingPart,
}: Pick<PartsToFillCardProps, 'lineups' | 'instrumentVocabulary' | 'onAddPart' | 'isAddingPart'>) {
  const [adding, setAdding] = useState(false);
  const [role, setRole] = useState('');
  // #983: `+ Add a part` asks which Lineup only when there is more than one.
  const [targetLineup, setTargetLineup] = useState<string>(lineups[0]?.id ?? '');
  const datalistId = useDatalistId();

  function submitPart() {
    const trimmed = role.trim();
    if (!trimmed) return;
    onAddPart(trimmed, lineups.length > 1 ? targetLineup || null : (lineups[0]?.id ?? null));
    setRole('');
    setAdding(false);
  }

  if (!adding) {
    return (
      <div className="pt-3">
        <GhostButton variant="primary" icon={<Plus size={14} />} onClick={() => setAdding(true)}>
          Add a part
        </GhostButton>
      </div>
    );
  }

  return (
    <div className="pt-3 space-y-2">
      <Input
        autoFocus
        value={role}
        onChange={(e) => setRole(e.target.value)}
        placeholder="Saxophone"
        aria-label="Part"
        list={datalistId}
        disabled={isAddingPart}
      />
      <datalist id={datalistId}>
        {instrumentVocabulary.map((r) => <option key={r} value={r} />)}
      </datalist>

      {lineups.length > 1 && (
        <Select value={targetLineup} onValueChange={setTargetLineup}>
          <SelectTrigger aria-label="Band">
            <SelectValue placeholder="Which band?" />
          </SelectTrigger>
          <SelectContent>
            {lineups.map((l) => (
              <SelectItem key={l.id} value={l.id}>{lineupName(l)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={submitPart} disabled={!role.trim() || isAddingPart}>
          {isAddingPart ? 'Adding…' : 'Add part'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => { setAdding(false); setRole(''); }}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function PartsToFillCard({
  vacantChairs,
  lineups,
  hasPackages,
  venue,
  instrumentVocabulary,
  onAssignChair,
  assigningChairId,
  onAddPart,
  isAddingPart,
  onRemovePart,
  removingPartId,
}: PartsToFillCardProps) {
  const nameBands = shouldNameBand(lineups);

  const lineupLabel = (lineupId: string) => {
    const lineup = lineups.find((l) => l.id === lineupId);
    return lineup ? lineupName(lineup) : undefined;
  };

  return (
    <Card title={vacantChairs.length ? 'Parts to fill' : 'Parts to fill · all filled'}>
      {vacantChairs.length === 0 ? (
        <p className="text-base text-muted">Every part on this gig has somebody playing it</p>
      ) : (
        <div>
          {vacantChairs.map((chair) => (
            // The divider belongs below the picker, not between the row and its own picker — a
            // vacant part and its "fill this" control are one unit, so PartRow's own border (from
            // LabelValue) is switched off here and moved to this wrapper instead.
            <div key={chair.id} className="pb-3 border-b border-border last:border-0 last:pb-0">
              <PartRow
                role={chair.role}
                callTimes={callTimeParts(chair, hasPackages)}
                bandName={nameBands ? lineupLabel(chair.lineupId) : undefined}
                bordered={false}
                action={
                  <IconButton
                    label={`Remove the ${chair.role} part`}
                    onClick={() => onRemovePart(chair.id)}
                    disabled={removingPartId === chair.id}
                    className="hover:text-status-cancelled"
                  >
                    <X size={14} />
                  </IconButton>
                }
              />
              <div className="pl-[84px] pt-1">
                <ContactPicker
                  value={null}
                  onChange={(contactId) => contactId && onAssignChair(chair.id, contactId)}
                  placeholder={`Fill this part…`}
                  chairRole={chair.role}
                  venue={venue}
                  disabled={assigningChairId === chair.id}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <AddPartFooter
        lineups={lineups}
        instrumentVocabulary={instrumentVocabulary}
        onAddPart={onAddPart}
        isAddingPart={isAddingPart}
      />
    </Card>
  );
}
