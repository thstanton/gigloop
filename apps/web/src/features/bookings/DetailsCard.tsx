import { Info } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { GhostButton } from '@/components/common/GhostButton';
import { EmptyState } from '@/components/common/EmptyState';
import { LabelValue } from '@/components/common/LabelValue';
import { LOGISTICS_FIELD_LABELS } from '@/lib/constants';
import type { BookingLogisticsEntry } from '@/types/api';

const DETAIL_FIELDS = [
  'dressCode',
  'performanceSpace',
  'foodProvided',
  'greenRoom',
  'equipmentRequired',
] as const;

interface DetailsCardProps {
  logistics: Record<string, BookingLogisticsEntry> | null;
  onEdit: () => void;
}

export default function DetailsCard({ logistics, onEdit }: DetailsCardProps) {
  const entries = DETAIL_FIELDS.filter(key => logistics?.[key]?.value);

  return (
    <Card
      title="Details"
      action={
        <GhostButton variant="primary" size="xs" onClick={onEdit}>
          Edit
        </GhostButton>
      }
    >
      {entries.length === 0 ? (
        <EmptyState
          icon={<Info size={24} />}
          heading="No details yet"
          description="Add dress code, performance space, and other logistics."
          className="py-6"
        />
      ) : (
        <div>
          {entries.map(key => (
            <LabelValue key={key} label={LOGISTICS_FIELD_LABELS[key]}>
              {logistics![key].value}
            </LabelValue>
          ))}
        </div>
      )}
    </Card>
  );
}
