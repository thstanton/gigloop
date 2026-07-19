import { cn } from '@/lib/utils';
import { TogglePill } from '@/components/ui/toggle-pill';
import { FormField } from '@/components/common/FormField';
import {
  BOOKING_STATUS_LABELS,
  STATUS_DESCRIPTIONS,
  CREATABLE_BOOKING_STATUSES,
  STATUS_TOKENS,
} from '@/lib/constants';
import type { BookingStatus } from '@/types/api';

interface StatusCoachingFieldProps {
  value: BookingStatus;
  onChange: (status: BookingStatus) => void;
}

/**
 * Create-form "starting status" control (ADR-0053, slice #545). A plain dropdown taught the
 * musician nothing; this teaches the lifecycle at the point of use (CONTEXT: discoverability is
 * in-context). The forward statuses render as colour-coded, radio-semantic pills (Cancelled is
 * not a creation status); the selected pill's CONTEXT-canon meaning is shown in a single panel
 * below — selected-only, so it stays lean at 375px rather than printing all five at once.
 *
 * Status stays create-shell-owned (not an Overview atom field): the booking's status transition
 * is a standalone confirmed action, an invariant this control preserves.
 */
export function StatusCoachingField({ value, onChange }: StatusCoachingFieldProps) {
  return (
    <FormField label="Starting status">
      <div className="space-y-3">
        <div role="radiogroup" aria-label="Starting status" className="flex flex-wrap gap-2">
          {CREATABLE_BOOKING_STATUSES.map((status) => {
            const selected = status === value;
            const { accent } = STATUS_TOKENS[status];
            return (
              <TogglePill
                key={status}
                role="radio"
                aria-checked={selected}
                active={selected}
                onClick={() => onChange(status)}
                className={selected ? cn(accent, 'border-transparent text-white') : undefined}
              >
                <span className={cn('h-2 w-2 rounded-full', selected ? 'bg-white/80' : accent)} />
                {BOOKING_STATUS_LABELS[status]}
              </TogglePill>
            );
          })}
        </div>
        <div className={cn('rounded-lg p-3', STATUS_TOKENS[value].tint)}>
          <p className="text-sm text-muted-foreground">
            <span className={cn('font-semibold', STATUS_TOKENS[value].text)}>{BOOKING_STATUS_LABELS[value]} · </span>
            {STATUS_DESCRIPTIONS[value]}
          </p>
        </div>
      </div>
    </FormField>
  );
}
