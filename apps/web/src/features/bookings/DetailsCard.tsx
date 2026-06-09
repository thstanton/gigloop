import { Info } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { GhostButton } from '@/components/common/GhostButton';
import { EmptyState } from '@/components/common/EmptyState';
import { LOGISTICS_FIELD_ICONS, LOGISTICS_FIELD_LABELS } from '@/lib/constants';
import FormatIcon from './FormatIcon';
import type { BookingLogisticsEntry } from '@/types/api';

const SYSTEM_DETAIL_KEYS = ['dressCode', 'performanceSpace', 'foodProvided', 'greenRoom', 'equipmentRequired'] as const;
const ALL_SYSTEM_KEYS = new Set([
  'arrivalTime', 'soundCheckTime', 'finishTime',
  'dressCode', 'performanceSpace', 'foodProvided', 'greenRoom', 'equipmentRequired',
]);

interface DetailsCardProps {
  logistics: Record<string, BookingLogisticsEntry> | null;
  onEdit: () => void;
}

export default function DetailsCard({ logistics, onEdit }: DetailsCardProps) {
  const systemEntries = SYSTEM_DETAIL_KEYS
    .filter(key => logistics?.[key]?.value)
    .map(key => ({
      key,
      label: LOGISTICS_FIELD_LABELS[key],
      entry: logistics![key],
      iconFallback: LOGISTICS_FIELD_ICONS[key] ?? '',
    }));

  const customEntries = logistics
    ? Object.entries(logistics)
        .filter(([key]) => !ALL_SYSTEM_KEYS.has(key) && logistics[key].value)
        .map(([key, entry]) => ({
          key,
          label: entry.label || key,
          entry,
          iconFallback: 'star',
        }))
    : [];

  const allEntries = [...systemEntries, ...customEntries];

  return (
    <Card
      title="Details"
      action={
        <GhostButton variant="primary" size="xs" onClick={onEdit}>
          Edit
        </GhostButton>
      }
    >
      {allEntries.length === 0 ? (
        <EmptyState
          icon={<Info size={24} />}
          heading="No details yet"
          description="Add dress code, performance space, and other logistics."
          className="py-6"
        />
      ) : (
        <div>
          {allEntries.map(({ key, label, entry, iconFallback }) => {
            const iconKey = entry.icon || iconFallback;
            return (
              <div key={key} className="py-3 flex items-start gap-2.5 border-b border-border last:border-0">
                <span className="mt-0.5 text-muted flex-shrink-0">
                  {iconKey && <FormatIcon icon={iconKey} size={16} />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted">{label}</p>
                  <p className="text-sm text-foreground">{entry.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
