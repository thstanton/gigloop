import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { PortalTheme } from '@/types/api';

export interface Overrides {
  theme: PortalTheme;
  brandColour: string;
  heroImage: 'piano' | 'stage' | null;
  showContactPhoto: boolean;
  showContactEmail: boolean;
  showContactPhone: boolean;
}

const THEMES: { value: PortalTheme; label: string; description: string }[] = [
  { value: 'LIGHT_MODERN', label: 'Light Modern', description: 'Clean, sans-serif' },
  { value: 'LIGHT_ROMANTIC', label: 'Light Romantic', description: 'Soft, script font' },
  { value: 'BOLD_MODERN', label: 'Bold Modern', description: 'Dark, contemporary' },
  { value: 'BOLD_ROMANTIC', label: 'Bold Romantic', description: 'Dark, elegant script' },
];

interface CustomiseSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  overrides: Overrides;
  onChange: (next: Partial<Overrides>) => void;
  onSave: () => void;
  isDirty: boolean;
  isSaving: boolean;
  hasPhoto: boolean;
  hasEmail: boolean;
  hasPhone: boolean;
}

export default function CustomiseSheet({
  open,
  onOpenChange,
  overrides,
  onChange,
  onSave,
  isDirty,
  isSaving,
  hasPhoto,
  hasEmail,
  hasPhone,
}: CustomiseSheetProps) {
  const bold = overrides.theme === 'BOLD_MODERN' || overrides.theme === 'BOLD_ROMANTIC';
  const hexRef = useRef<HTMLInputElement>(null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-80 overflow-y-auto flex flex-col gap-0 p-0">
        <SheetHeader className="px-5 py-4 border-b border-border">
          <SheetTitle>Customise portal</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7">
          {/* Theme */}
          <div className="space-y-3">
            <Label>Theme</Label>
            <div className="grid grid-cols-2 gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => onChange({ theme: t.value })}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-colors',
                    overrides.theme === t.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-foreground/30',
                  )}
                >
                  <p className="text-sm font-medium text-foreground leading-tight">{t.label}</p>
                  <p className="text-xs text-muted mt-0.5">{t.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Brand colour */}
          <div className="space-y-3">
            <Label>Brand colour</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={overrides.brandColour}
                onChange={(e) => onChange({ brandColour: e.target.value })}
                className="h-9 w-10 rounded border border-border cursor-pointer p-0.5 bg-background flex-shrink-0"
                style={{ accentColor: overrides.brandColour }}
              />
              <Input
                ref={hexRef}
                value={overrides.brandColour}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) onChange({ brandColour: val });
                }}
                className="font-mono text-sm"
                maxLength={7}
              />
            </div>
          </div>

          {/* Hero image (BOLD only) */}
          {bold && (
            <div className="space-y-3">
              <Label>Hero image</Label>
              <div className="space-y-2">
                {([null, 'piano', 'stage'] as const).map((img) => (
                  <button
                    key={String(img)}
                    type="button"
                    onClick={() => onChange({ heroImage: img })}
                    className={cn(
                      'w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                      overrides.heroImage === img
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
                        style={{ backgroundColor: overrides.brandColour }}
                      />
                    )}
                    <span className="text-sm font-medium text-foreground capitalize">
                      {img ?? 'None (brand colour)'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Contact card */}
          <div className="space-y-3">
            <Label>Contact card</Label>
            <div className="space-y-2.5">
              {hasPhoto && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overrides.showContactPhoto}
                    onChange={(e) => onChange({ showContactPhoto: e.target.checked })}
                    className="h-4 w-4 rounded border-border"
                  />
                  <span className="text-sm text-foreground">Show photo</span>
                </label>
              )}
              {hasEmail && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overrides.showContactEmail}
                    onChange={(e) => onChange({ showContactEmail: e.target.checked })}
                    className="h-4 w-4 rounded border-border"
                  />
                  <span className="text-sm text-foreground">Show email</span>
                </label>
              )}
              {hasPhone && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overrides.showContactPhone}
                    onChange={(e) => onChange({ showContactPhone: e.target.checked })}
                    className="h-4 w-4 rounded border-border"
                  />
                  <span className="text-sm text-foreground">Show phone</span>
                </label>
              )}
              {!hasPhoto && !hasEmail && !hasPhone && (
                <p className="text-sm text-muted">Add contact details in Settings to configure visibility.</p>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border">
          <Button
            className="w-full"
            disabled={!isDirty || isSaving}
            onClick={onSave}
          >
            {isSaving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
