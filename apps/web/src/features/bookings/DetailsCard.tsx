import { useSearchParams } from 'react-router-dom';
import { Info, Plus } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { GhostButton } from '@/components/common/GhostButton';
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
  hideWhenEmpty?: boolean;
}

export default function DetailsCard({ logistics, hideWhenEmpty = false }: DetailsCardProps) {
  const [, setSearchParams] = useSearchParams();
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

  if (hideWhenEmpty && allEntries.length === 0) return null;

  if (allEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center gap-2 py-4 text-muted min-h-[5rem]">
        <Info size={20} />
        <span className="text-sm font-medium">Details</span>
        <button
          type="button"
          onClick={() => setSearchParams({ sheet: 'detailsTweak' })}
          className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
        >
          <Plus size={14} />
          Add details
        </button>
      </div>
    );
  }

  return (
    <Card
      title="Details"
      action={
        <GhostButton variant="primary" size="xs" onClick={() => setSearchParams({ sheet: 'detailsTweak' })}>
          Edit
        </GhostButton>
      }
    >
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
    </Card>
  );
}
