import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import type { LineupTemplate } from '@/types/api';

// Band members v1 (#879, ADR-0072 §3): the library grid on the Lineups tab of /admin/packages,
// symmetric with PackagesPage's own PackageCard grid.
export function LineupList({
  lineups,
  onEdit,
  onCreate,
}: {
  lineups: LineupTemplate[];
  onEdit: (lineup: LineupTemplate) => void;
  onCreate: () => void;
}) {
  if (lineups.length === 0) {
    return (
      <EmptyState
        icon={<Users size={40} strokeWidth={1.5} />}
        heading="No lineups yet"
        description={'Build a reusable lineup — like "My five-piece" — to apply to bookings.'}
        action={<Button onClick={onCreate}>New lineup</Button>}
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {lineups.map((lineup) => (
        <Card key={lineup.id} className="space-y-3">
          <span className="text-sm font-medium text-foreground truncate block">{lineup.label}</span>

          {lineup.slots.length > 0 && (
            <ul className="space-y-1">
              {lineup.slots.map((slot) => (
                <li key={slot.id} className="text-sm text-muted truncate">
                  {slot.role || 'Unnamed'}
                </li>
              ))}
            </ul>
          )}

          <Button variant="outline" size="sm" onClick={() => onEdit(lineup)} className="w-full">
            Edit
          </Button>
        </Card>
      ))}
    </div>
  );
}
