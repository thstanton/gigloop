import { Users, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import type { LineupTemplate } from '@/types/api';

// One chair, rendered as a small avatar with its role underneath. No `truncate` — a longer role
// ("Vocals & guitar") wraps onto a second line rather than losing information; the card grows to
// fit rather than clipping it. Validated via /prototype against a solo through six-piece.
function ChairAvatar({ role }: { role: string }) {
  return (
    <div className="flex flex-col items-center gap-1 w-20">
      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
        <UserRound size={22} strokeWidth={1.5} />
      </div>
      <span className="text-xs text-muted text-center leading-tight w-full break-words">
        {role || 'Unnamed'}
      </span>
    </div>
  );
}

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
        <Card key={lineup.id} className="space-y-1">
          <span className="text-sm font-medium text-foreground truncate block text-center">{lineup.label}</span>

          {lineup.slots.length > 0 && (
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-6 py-2">
              {lineup.slots.map((slot) => (
                <ChairAvatar key={slot.id} role={slot.role} />
              ))}
            </div>
          )}

          <Button variant="outline" size="sm" onClick={() => onEdit(lineup)} className="w-full">
            Edit
          </Button>
        </Card>
      ))}
    </div>
  );
}
