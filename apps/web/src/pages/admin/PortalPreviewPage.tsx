import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, FileText, Music } from 'lucide-react';
import { apiGet, apiPatch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { PortalLayout } from '@/layouts/PortalLayout';
import {
  LightGreeting,
  BoldHero,
  ContactCard,
  SetsCard,
  bookingStatusMessage,
  pickTextColour,
} from '@/pages/portal/PortalPage';
import type { PublicProfile, PortalPublicProfile, PortalTheme, UpdatePublicProfileInput } from '@/types/api';
import { cn } from '@/lib/utils';

// ─── Mock booking data ────────────────────────────────────────────────────────

const PREVIEW_DATE = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
const PREVIEW_FORMATTED_DATE = PREVIEW_DATE.toLocaleDateString('en-GB', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
});

const PREVIEW_SETS = [
  { order: 0, label: null, startTime: '4:00 pm', duration: 60, performanceFormatId: 'fmt1' },
  { order: 1, label: null, startTime: '7:00 pm', duration: 45, performanceFormatId: 'fmt2' },
  { order: 2, label: 'Set 1', startTime: '8:30 pm', duration: 60, performanceFormatId: 'fmt3' },
  { order: 3, label: 'Set 2', startTime: '10:00 pm', duration: 60, performanceFormatId: 'fmt3' },
];

const PREVIEW_FORMATS = [
  { id: 'fmt1', label: 'Drinks Reception', icon: 'glass-water', order: 0 },
  { id: 'fmt2', label: 'Wedding Breakfast', icon: 'utensils', order: 1 },
  { id: 'fmt3', label: 'Evening', icon: 'moon', order: 2 },
];

const PREVIEW_GREETING_NAME = 'Sarah';
const PREVIEW_TITLE = 'The Anderson Wedding';
const PREVIEW_VENUE = 'The Grand Ballroom';
const PREVIEW_FEE = '1,500';

// ─── Local overrides state ────────────────────────────────────────────────────

interface Overrides {
  theme: PortalTheme;
  brandColour: string;
  heroImage: 'piano' | 'stage' | null;
  showContactPhoto: boolean;
  showContactEmail: boolean;
  showContactPhone: boolean;
}

function profileToOverrides(p: PublicProfile): Overrides {
  return {
    theme: (p.portalTheme as PortalTheme) ?? 'LIGHT_MODERN',
    brandColour: p.brandColour ?? '#1a1a1a',
    heroImage: (p.portalHeroImage as 'piano' | 'stage' | null) ?? null,
    showContactPhoto: p.showContactPhoto,
    showContactEmail: p.showContactEmail,
    showContactPhone: p.showContactPhone,
  };
}

function buildPreviewProfile(profile: PublicProfile, overrides: Overrides): PortalPublicProfile {
  return {
    businessName: profile.businessName,
    displayName: profile.displayName,
    bio: profile.bio,
    email: profile.email,
    phone: profile.phone,
    logoUrl: profile.logoUrl,
    brandColour: overrides.brandColour,
    photo: profile.photo,
    portalTheme: overrides.theme,
    portalHeroImage: overrides.heroImage,
    showContactPhoto: overrides.showContactPhoto,
    showContactEmail: overrides.showContactEmail,
    showContactPhone: overrides.showContactPhone,
  };
}

// ─── Preview booking summary (simplified, no live links) ─────────────────────

function PreviewBookingSummary({ profile, bold }: { profile: PortalPublicProfile; bold: boolean }) {
  const brand = profile.brandColour ?? '#1a1a1a';
  const ctaTextColour = bold ? pickTextColour(brand) : brand;

  const labelClass = bold
    ? 'text-white/50'
    : 'text-[#a39e97] text-xs uppercase tracking-wide font-medium';
  const valueClass = `font-medium ${bold ? 'text-white' : 'text-[#1a1a1a]'}`;
  const cardClass = bold ? 'rounded-lg px-5 py-5 space-y-3.5 bg-white/15' : 'rounded-lg px-6 py-5 space-y-4 bg-[#f5f2ed]';
  const ctaClass = bold
    ? 'flex items-center justify-center gap-2 w-full rounded-lg px-5 py-3.5 text-sm font-medium'
    : 'flex items-center justify-center gap-2 w-full rounded-lg px-5 py-3.5 text-sm font-medium border';
  const ctaStyle = bold
    ? { backgroundColor: brand, color: ctaTextColour }
    : { borderColor: brand, color: brand };

  return (
    <div className="space-y-5">
      <div className={cardClass}>
        <div className="flex justify-between items-baseline text-sm gap-4">
          <span className={labelClass}>Date</span>
          <span className={valueClass}>{PREVIEW_FORMATTED_DATE}</span>
        </div>
        <div className="flex justify-between items-baseline text-sm gap-4">
          <span className={labelClass}>Venue</span>
          <span className={`${valueClass} text-right`}>{PREVIEW_VENUE}</span>
        </div>
        <div className="flex justify-between items-baseline text-sm gap-4">
          <span className={labelClass}>Fee</span>
          <span className={valueClass}>£{PREVIEW_FEE}</span>
        </div>
      </div>

      <SetsCard sets={PREVIEW_SETS} formats={PREVIEW_FORMATS} bold={bold} />

      <div className={ctaClass} style={ctaStyle}>
        <FileText className="h-4 w-4" />
        Review &amp; sign contract
      </div>

      <div className={ctaClass} style={ctaStyle}>
        <Music className="h-4 w-4" />
        Choose your songs
      </div>
    </div>
  );
}

// ─── Theme picker ─────────────────────────────────────────────────────────────

const THEMES: { value: PortalTheme; label: string; description: string }[] = [
  { value: 'LIGHT_MODERN', label: 'Light Modern', description: 'Clean, sans-serif' },
  { value: 'LIGHT_ROMANTIC', label: 'Light Romantic', description: 'Soft, script font' },
  { value: 'BOLD_MODERN', label: 'Bold Modern', description: 'Dark, contemporary' },
  { value: 'BOLD_ROMANTIC', label: 'Bold Romantic', description: 'Dark, elegant script' },
];

// ─── Customise sheet ──────────────────────────────────────────────────────────

function CustomiseSheet({
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
}: {
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
}) {
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortalPreviewPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isLoaded && !isSignedIn) navigate('/sign-in', { replace: true });
  }, [isLoaded, isSignedIn, navigate]);

  const { data: profile } = useQuery({
    queryKey: ['publicProfile'],
    queryFn: () => apiGet<PublicProfile>('/me/public'),
    enabled: isLoaded && !!isSignedIn,
  });

  const [overrides, setOverrides] = useState<Overrides | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Initialise overrides once profile loads
  useEffect(() => {
    if (profile && overrides === null) {
      setOverrides(profileToOverrides(profile));
    }
  }, [profile, overrides]);

  const saveMutation = useMutation({
    mutationFn: (data: UpdatePublicProfileInput) => apiPatch<PublicProfile>('/me/public', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publicProfile'] });
      setIsDirty(false);
    },
  });

  function handleChange(partial: Partial<Overrides>) {
    setOverrides((prev) => prev ? { ...prev, ...partial } : prev);
    setIsDirty(true);
  }

  function handleSave() {
    if (!overrides) return;
    saveMutation.mutate({
      brandColour: overrides.brandColour,
      portalTheme: overrides.theme,
      portalHeroImage: overrides.heroImage,
      showContactPhoto: overrides.showContactPhoto,
      showContactEmail: overrides.showContactEmail,
      showContactPhone: overrides.showContactPhone,
    });
  }

  if (!isLoaded || !isSignedIn || !profile || !overrides) return null;

  const previewProfile = buildPreviewProfile(profile, overrides);
  const boldTheme = overrides.theme === 'BOLD_MODERN' || overrides.theme === 'BOLD_ROMANTIC';
  const brand = overrides.brandColour;
  const statusMessage = bookingStatusMessage('CONFIRMED');

  const hero = boldTheme ? (
    <BoldHero
      greetingName={PREVIEW_GREETING_NAME}
      title={PREVIEW_TITLE}
      formattedDate={PREVIEW_FORMATTED_DATE}
      statusMessage={statusMessage}
      portalHeroImage={overrides.heroImage}
      theme={overrides.theme}
      brand={brand}
    />
  ) : undefined;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Admin top bar */}
      <div className="sticky top-0 z-50 bg-background border-b border-border h-12 flex items-center justify-between gap-3 px-4 shrink-0">
        <Link
          to="/admin/settings"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} />
          Settings
        </Link>
        <span className="text-sm font-medium text-foreground">Portal preview</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
            Customise
          </Button>
          <Button
            size="sm"
            disabled={!isDirty || saveMutation.isPending}
            onClick={handleSave}
          >
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Portal preview */}
      <div className="flex-1">
        <PortalLayout profile={previewProfile} wide hero={hero}>
          {!boldTheme && (
            <LightGreeting
              greetingName={PREVIEW_GREETING_NAME}
              title={PREVIEW_TITLE}
              statusMessage={statusMessage}
              theme={overrides.theme}
            />
          )}
          <div className="md:grid md:grid-cols-[1fr_280px] md:gap-8 md:items-start">
            <PreviewBookingSummary profile={previewProfile} bold={boldTheme} />
            <div className="mt-8 md:mt-0 md:sticky md:top-8">
              <ContactCard profile={previewProfile} bold={boldTheme} />
            </div>
          </div>
        </PortalLayout>
      </div>

      <CustomiseSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        overrides={overrides}
        onChange={handleChange}
        onSave={handleSave}
        isDirty={isDirty}
        isSaving={saveMutation.isPending}
        hasPhoto={!!profile.photo}
        hasEmail={!!profile.email}
        hasPhone={!!profile.phone}
      />
    </div>
  );
}
