import { TogglePill } from '@/components/ui/toggle-pill';
import { APPEARANCE_PREFERENCES, type AppearancePreference } from '@/lib/constants';

interface AppearanceControlProps {
  value: AppearancePreference;
  onChange: (preference: AppearancePreference) => void;
}

/**
 * System / Light / Dark control (ADR-0085 §3). Presentational: the caller owns the preference
 * (via `useAppearance`) and decides whether to render it at all (flag gating lives in the shell).
 * Radio semantics mirror `StatusCoachingField`; options derive from `APPEARANCE_PREFERENCES`.
 */
export function AppearanceControl({ value, onChange }: Readonly<AppearanceControlProps>) {
  return (
    <div role="radiogroup" aria-label="Appearance" className="flex flex-wrap gap-2">
      {APPEARANCE_PREFERENCES.map((option) => {
        const selected = option.value === value;
        return (
          <TogglePill
            key={option.value}
            role="radio"
            aria-checked={selected}
            active={selected}
            title={option.description}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </TogglePill>
        );
      })}
    </div>
  );
}
