import { useSearchParams } from 'react-router-dom';
import { Info, Pencil, Plus } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { GhostButton } from '@/components/common/GhostButton';
import { EmptyState } from '@/components/common/EmptyState';
import {
  LOGISTICS_DETAIL_KEYS,
  LOGISTICS_FIELD_ICONS,
  LOGISTICS_FIELD_LABELS,
  LOGISTICS_SYSTEM_KEYS,
} from '@/lib/constants';
import FormatIcon from './FormatIcon';
import type { BookingLogisticsEntry } from '@/types/api';

const ALL_SYSTEM_KEYS = new Set<string>(LOGISTICS_SYSTEM_KEYS);

interface DetailsCardProps {
  logistics: Record<string, BookingLogisticsEntry> | null;
  hideWhenEmpty?: boolean;
}

export default function DetailsCard({ logistics, hideWhenEmpty = false }: DetailsCardProps) {
  const [, setSearchParams] = useSearchParams();
  const systemEntries = LOGISTICS_DETAIL_KEYS
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
      <EmptyState
        icon={<Info size={24} />}
        heading="No details yet"
        description="Add dress code, performance space, and on-the-day details."
        action={
          <GhostButton variant="primary" size="xs" icon={<Plus size={13} />} onClick={() => setSearchParams({ sheet: 'detailsTweak' })}>
            Add details
          </GhostButton>
        }
        className="h-full justify-center py-6"
      />
    );
  }

  return (
    <Card
      title="Details"
      action={
        <GhostButton variant="primary" size="xs" icon={<Pencil size={13} />} onClick={() => setSearchParams({ sheet: 'detailsTweak' })}>
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
