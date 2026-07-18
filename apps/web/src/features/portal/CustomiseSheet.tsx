import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  ThemeCards,
  BrandColourControl,
  HeroImagePicker,
  type PortalHeroImage,
} from '@/features/portal/BrandingControls';
import type { PortalTheme } from '@/types/api';

export interface Overrides {
  theme: PortalTheme;
  brandColour: string;
  heroImage: PortalHeroImage;
  showContactPhoto: boolean;
  showContactEmail: boolean;
  showContactPhone: boolean;
}

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
            <ThemeCards value={overrides.theme} onChange={(theme) => onChange({ theme })} />
          </div>

          {/* Brand colour */}
          <div className="space-y-3">
            <Label>Brand colour</Label>
            <BrandColourControl
              value={overrides.brandColour}
              onChange={(brandColour) => onChange({ brandColour })}
            />
          </div>

          {/* Hero image (BOLD only) */}
          {bold && (
            <div className="space-y-3">
              <Label>Hero image</Label>
              <HeroImagePicker
                value={overrides.heroImage}
                brandColour={overrides.brandColour}
                onChange={(heroImage) => onChange({ heroImage })}
              />
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
