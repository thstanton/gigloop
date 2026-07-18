import { Input } from '@/components/ui/input';
import { PORTAL_THEME_OPTIONS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { PortalTheme } from '@/types/api';

export type PortalHeroImage = 'piano' | 'stage' | null;

/**
 * The individual portal-branding controls, extracted from CustomiseSheet so the
 * onboarding portal step can lay them out inline while the admin preview keeps
 * them in a sheet. All fully controlled — no fetches, no persistence.
 */

export function ThemeCards({
  value,
  onChange,
}: {
  value: PortalTheme;
  onChange: (theme: PortalTheme) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {PORTAL_THEME_OPTIONS.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={cn(
            'rounded-lg border p-3 text-left transition-colors',
            value === t.value
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-foreground/30',
          )}
        >
          <p className="text-sm font-medium text-foreground leading-tight">{t.label}</p>
          <p className="text-xs text-muted mt-0.5">{t.description}</p>
        </button>
      ))}
    </div>
  );
}

export function BrandColourControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-10 rounded border border-border cursor-pointer p-0.5 bg-background flex-shrink-0"
        style={{ accentColor: value }}
        aria-label="Brand colour"
      />
      <Input
        value={value}
        onChange={(e) => {
          if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) onChange(e.target.value);
        }}
        className="font-mono text-sm"
        maxLength={7}
        aria-label="Brand colour hex"
      />
    </div>
  );
}

/** Bold themes only — pick the hero image (or fall back to the brand colour). */
export function HeroImagePicker({
  value,
  brandColour,
  onChange,
}: {
  value: PortalHeroImage;
  brandColour: string;
  onChange: (img: PortalHeroImage) => void;
}) {
  return (
    <div className="space-y-2">
      {([null, 'piano', 'stage'] as const).map((img) => (
        <button
          key={String(img)}
          type="button"
          onClick={() => onChange(img)}
          className={cn(
            'w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
            value === img
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-foreground/30',
          )}
        >
          {img ? (
            <img
              src={`/${img}.png`}
              alt={img}
              className="w-12 h-8 rounded object-cover flex-shrink-0"
            />
          ) : (
            <div
              className="w-12 h-8 rounded flex-shrink-0"
              style={{ backgroundColor: brandColour }}
            />
          )}
          <span className="text-sm font-medium text-foreground capitalize">
            {img ?? 'None (brand colour)'}
          </span>
        </button>
      ))}
    </div>
  );
}
