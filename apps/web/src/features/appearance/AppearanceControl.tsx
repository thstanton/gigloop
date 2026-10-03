import { useRef } from 'react';
import { TogglePill } from '@/components/ui/toggle-pill';
import { APPEARANCE_PREFERENCES, type AppearancePreference } from '@/lib/constants';

interface AppearanceControlProps {
  value: AppearancePreference;
  onChange: (preference: AppearancePreference) => void;
}

const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown']);
const PREVIOUS_KEYS = new Set(['ArrowLeft', 'ArrowUp']);

/**
 * System / Light / Dark control (ADR-0085 §3). Presentational: the caller owns the preference
 * (via `useAppearance`) and decides whether to render it at all (flag gating lives in the shell).
 * Radio semantics mirror `StatusCoachingField`; options derive from `APPEARANCE_PREFERENCES`.
 * Arrow keys move and select (roving tabindex); Space/click select the focused pill.
 */
export function AppearanceControl({ value, onChange }: Readonly<AppearanceControlProps>) {
  const group = useRef<HTMLDivElement>(null);

  const move = (from: number, step: 1 | -1) => {
    const count = APPEARANCE_PREFERENCES.length;
    const next = (from + step + count) % count;
    onChange(APPEARANCE_PREFERENCES[next].value);
    group.current?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (NEXT_KEYS.has(event.key)) move(index, 1);
    else if (PREVIOUS_KEYS.has(event.key)) move(index, -1);
    else return;
    event.preventDefault();
  };

  return (
    <div ref={group} role="radiogroup" aria-label="Appearance" className="flex flex-wrap gap-2">
      {APPEARANCE_PREFERENCES.map((option, index) => {
        const selected = option.value === value;
        return (
          <TogglePill
            key={option.value}
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            active={selected}
            title={option.description}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {option.label}
          </TogglePill>
        );
      })}
    </div>
  );
}
