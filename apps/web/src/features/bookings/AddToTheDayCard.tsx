import type { ReactNode } from 'react';
import { Card } from '@/components/common/Card';
import { GhostButton } from '@/components/common/GhostButton';
import { Plus } from 'lucide-react';

export interface AddToTheDayConcern {
  label: string;
  icon: ReactNode;
  actionLabel: string;
  onAction: () => void;
}

interface AddToTheDayCardProps {
  concerns: AddToTheDayConcern[];
}

/** Combined mobile card listing missing PM-hat concerns as add-rows. */
export function AddToTheDayCard({ concerns }: AddToTheDayCardProps) {
  if (concerns.length === 0) return null;
  return (
    <Card title="Add to the day">
      <div>
        {concerns.map((concern, i) => (
          <div
            key={concern.label}
            className={`flex items-center gap-3 py-3${i < concerns.length - 1 ? ' border-b border-border' : ''}`}
          >
            <span className="text-muted flex-shrink-0">{concern.icon}</span>
            <span className="flex-1 text-sm text-foreground">{concern.label}</span>
            <GhostButton
              variant="primary"
              size="xs"
              icon={<Plus size={13} />}
              onClick={concern.onAction}
            >
              {concern.actionLabel}
            </GhostButton>
          </div>
        ))}
      </div>
    </Card>
  );
}
