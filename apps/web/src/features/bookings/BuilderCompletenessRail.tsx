import {
  CompletenessStatusIcon,
  type CompletenessStatus,
  type SpineId,
} from '@/features/bookings/builderCompleteness';
import { SPINE } from '@/features/bookings/builderSpine';

export function BuilderCompletenessRail({
  completeness,
  onScrollTo,
}: {
  completeness: Record<SpineId, CompletenessStatus>;
  onScrollTo: (id: SpineId) => void;
}): React.JSX.Element {
  return (
    <nav aria-label="Builder sections" className="space-y-1">
      {SPINE.map(({ id, label, Icon }) => {
        const status = completeness[id];
        return (
          <button
            key={id}
            type="button"
            onClick={() => onScrollTo(id)}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted transition-colors hover:bg-accent hover:text-foreground"
          >
            <Icon size={14} className="flex-shrink-0 text-muted" aria-hidden="true" />
            <span className="flex-1 text-left">{label}</span>
            <CompletenessStatusIcon status={status} />
          </button>
        );
      })}
    </nav>
  );
}
