import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, Download, FileText, Music, Search } from 'lucide-react';
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
import { PortalLayout, getDisplayFontClass } from '@/layouts/PortalLayout';
import {
  LightGreeting,
  BoldHero,
  ContactCard,
  SetsCard,
  bookingStatusMessage,
  pickTextColour,
} from '@/pages/portal/PortalPage';
import { SignatureSection } from '@/pages/portal/PortalContractPage';
import type { PublicProfile, PortalPublicProfile, PortalTheme, UpdatePublicProfileInput } from '@/types/api';
import { cn } from '@/lib/utils';

// ─── Mock data ────────────────────────────────────────────────────────────────

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

const PREVIEW_SONGS = [
  { title: 'A Thousand Years', artist: 'Christina Perri', genre: 'Pop' },
  { title: "Can't Help Falling in Love", artist: 'Elvis Presley', genre: 'Pop' },
  { title: 'Perfect', artist: 'Ed Sheeran', genre: 'Pop' },
  { title: 'Fly Me to the Moon', artist: 'Frank Sinatra', genre: 'Jazz' },
  { title: 'At Last', artist: 'Etta James', genre: 'Jazz' },
  { title: 'Clair de Lune', artist: 'Debussy', genre: 'Classical' },
  { title: 'Gymnopédie No. 1', artist: 'Satie', genre: 'Classical' },
];

const PREVIEW_GREETING_NAME = 'Sarah';
const PREVIEW_TITLE = 'The Anderson Wedding';
const PREVIEW_VENUE = 'The Grand Ballroom';
const PREVIEW_FEE = '1,500';

const PREVIEW_KEY_MOMENTS = [
  { section: 'Ceremony', label: 'Processional' },
  { section: 'Ceremony', label: 'First dance' },
  { section: 'Reception', label: 'Cake cutting' },
];

const PREVIEW_DOCUMENTS = [
  { label: 'Performance contract' },
  { label: 'Deposit invoice' },
];

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

// ─── Preview: booking page ────────────────────────────────────────────────────

function PreviewBookingView({
  profile,
  bold,
  onNavigate,
}: {
  profile: PortalPublicProfile;
  bold: boolean;
  onNavigate: (page: PreviewPage) => void;
}) {
  const brand = profile.brandColour ?? '#1a1a1a';
  const labelClass = bold
    ? 'text-white/50'
    : 'text-[#a39e97] text-xs uppercase tracking-wide font-medium';
  const valueClass = `font-medium ${bold ? 'text-white' : 'text-[#1a1a1a]'}`;
  const cardClass = bold
    ? 'rounded-lg px-5 py-5 space-y-3.5 bg-white/15'
    : 'rounded-lg px-6 py-5 space-y-4 bg-[#f5f2ed]';
  const ctaClass = bold
    ? 'flex items-center justify-center gap-2 w-full rounded-lg px-5 py-3.5 text-sm font-medium transition-opacity hover:opacity-90'
    : 'flex items-center justify-center gap-2 w-full rounded-lg px-5 py-3.5 text-sm font-medium transition-colors border hover:bg-[#f5f2ed]';
  const ctaStyle = bold
    ? { backgroundColor: brand, color: pickTextColour(brand) }
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

      <button type="button" onClick={() => onNavigate('contract')} className={ctaClass} style={ctaStyle}>
        <FileText className="h-4 w-4" />
        Review &amp; sign contract
      </button>

      <button type="button" onClick={() => onNavigate('music')} className={ctaClass} style={ctaStyle}>
        <Music className="h-4 w-4" />
        Choose your songs
      </button>

      <div className="space-y-2 pt-1">
        <p className={`text-xs font-medium uppercase tracking-wide ${bold ? 'text-white/35' : 'text-[#a39e97]'}`}>
          Documents
        </p>
        <div className={`rounded-lg divide-y ${bold ? 'divide-white/10 bg-white/15' : 'divide-[#ede9e4] bg-[#f5f2ed]'}`}>
          {PREVIEW_DOCUMENTS.map((doc) => (
            <div
              key={doc.label}
              className={`flex items-center gap-3 px-4 py-3 text-sm ${bold ? 'text-white' : 'text-[#1a1a1a]'}`}
            >
              <FileText className={`h-4 w-4 flex-shrink-0 ${bold ? 'text-white/35' : 'text-[#b0a89c]'}`} />
              <span className="flex-1 min-w-0 truncate">{doc.label}</span>
              <Download className={`h-3.5 w-3.5 flex-shrink-0 ${bold ? 'text-white/35' : 'text-[#b0a89c]'}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Preview: contract page ───────────────────────────────────────────────────

function PreviewContractView({
  profile,
  bold,
}: {
  profile: PortalPublicProfile;
  bold: boolean;
}) {
  const brand = profile.brandColour ?? '#1a1a1a';
  const displayFont = getDisplayFontClass(profile.portalTheme);
  const [agreed, setAgreed] = useState(false);

  return (
    <PortalLayout profile={profile}>
      <div className="space-y-8">
        <div>
          <h1 className={`${displayFont} text-3xl mb-1 ${bold ? 'text-white' : 'text-[#1a1a1a]'}`}>
            Performance Agreement
          </h1>
          <p className={`text-sm ${bold ? 'text-white/60' : 'text-[#6b7280]'}`}>
            Please read carefully before signing
          </p>
        </div>

        <div className={`rounded-lg p-6 space-y-4 ${bold ? 'bg-white/10' : 'bg-white border border-[#e5e5e5]'}`}>
          <p className={`text-sm leading-relaxed ${bold ? 'text-white/75' : 'text-[#374151]'}`}>
            This Performance Agreement is entered into between <strong>{profile.businessName}</strong> ("Performer") and Sarah &amp; James Anderson ("Client") for the event <em>{PREVIEW_TITLE}</em> on {PREVIEW_FORMATTED_DATE} at {PREVIEW_VENUE}.
          </p>
          <p className={`text-sm leading-relaxed ${bold ? 'text-white/75' : 'text-[#374151]'}`}>
            <strong>1. Services.</strong> The Performer agrees to provide live musical entertainment for the event as outlined in the booking details, including all agreed sets and formats.
          </p>
          <p className={`text-sm leading-relaxed ${bold ? 'text-white/75' : 'text-[#374151]'}`}>
            <strong>2. Fee.</strong> The agreed performance fee is £{PREVIEW_FEE}. A deposit is payable upon signing, with the balance due no later than 7 days before the event date.
          </p>
          <p className={`text-sm leading-relaxed ${bold ? 'text-white/75' : 'text-[#374151]'}`}>
            <strong>3. Cancellation.</strong> In the event of cancellation by the Client with less than 30 days' notice, the deposit is non-refundable. The Performer reserves the right to cancel due to illness or emergency, in which case a full refund will be issued.
          </p>
        </div>

        <div className="space-y-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[#e5e5e5] flex-shrink-0"
            />
            <span className={`text-sm ${bold ? 'text-white/80' : 'text-[#374151]'}`}>
              I have read and agree to the terms above
            </span>
          </label>

          {agreed && (
            <div className="space-y-3">
              <p className={`text-sm font-medium ${bold ? 'text-white' : 'text-[#1a1a1a]'}`}>
                Sign below
              </p>
              <SignatureSection onSign={() => {}} brand={brand} isBold={bold} />
            </div>
          )}

          <button
            type="button"
            disabled
            className="w-full rounded-lg px-5 py-3 text-sm font-medium text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: brand }}
          >
            Sign contract
          </button>
        </div>
      </div>
    </PortalLayout>
  );
}

// ─── Preview: music page ──────────────────────────────────────────────────────

function PreviewMusicView({
  profile,
  bold,
}: {
  profile: PortalPublicProfile;
  bold: boolean;
}) {
  const brand = profile.brandColour ?? '#1a1a1a';
  const displayFont = getDisplayFontClass(profile.portalTheme);
  const [selected, setSelected] = useState(new Set(['0']));
  const [search, setSearch] = useState('');
  const [activeGenre, setActiveGenre] = useState('Pop');

  const genres = ['Pop', 'Jazz', 'Classical'];

  const displaySongs = search.trim()
    ? PREVIEW_SONGS.filter(
        (s) =>
          s.title.toLowerCase().includes(search.toLowerCase()) ||
          s.artist.toLowerCase().includes(search.toLowerCase()),
      )
    : PREVIEW_SONGS.filter((s) => s.genre === activeGenre);

  const inputClass = `w-full rounded-lg border px-3 py-2.5 text-sm outline-none ${
    bold
      ? 'bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-white/60'
      : 'bg-white border-[#e5e5e5] text-[#1a1a1a] placeholder-[#9ca3af] focus:border-[#1a1a1a]'
  }`;

  const genreClass = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
      active
        ? bold ? 'bg-white text-[#1a1a1a]' : 'bg-[#1a1a1a] text-white'
        : bold ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb]'
    }`;

  const sectionHeadingClass = `text-xs font-medium uppercase tracking-wide mb-3 ${bold ? 'text-white/50' : 'text-[#9ca3af]'}`;

  // Group key moments by section
  const sectionMap = new Map<string, typeof PREVIEW_KEY_MOMENTS>();
  for (const km of PREVIEW_KEY_MOMENTS) {
    if (!sectionMap.has(km.section)) sectionMap.set(km.section, []);
    sectionMap.get(km.section)!.push(km);
  }

  return (
    <PortalLayout profile={profile}>
      <div className="space-y-8">
        <div>
          <h1 className={`${displayFont} text-3xl mb-1 ${bold ? 'text-white' : 'text-[#1a1a1a]'}`}>
            Song requests
          </h1>
          <p className={`text-sm ${bold ? 'text-white/60' : 'text-[#6b7280]'}`}>
            Choose songs you'd like to hear and pick something special for key moments.
          </p>
        </div>

        {/* 1. General requests */}
        <section className="space-y-4">
          <h2 className={`text-base font-semibold ${bold ? 'text-white' : 'text-[#1a1a1a]'}`}>
            General requests
          </h2>

          {/* Search */}
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${bold ? 'text-white/40' : 'text-[#9ca3af]'}`} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search all songs…"
              className={`${inputClass} pl-9`}
            />
          </div>

          {/* Genre tabs */}
          {!search.trim() && (
            <div className="flex flex-wrap gap-2">
              {genres.map((g) => (
                <button key={g} type="button" onClick={() => setActiveGenre(g)} className={genreClass(g === activeGenre)}>
                  {g}
                </button>
              ))}
            </div>
          )}

          {/* Song list */}
          <div className={`rounded-lg divide-y overflow-hidden ${bold ? 'divide-white/10 bg-white/5' : 'divide-[#e5e5e5] border border-[#e5e5e5]'}`}>
            {displaySongs.length === 0 ? (
              <p className={`px-4 py-6 text-sm text-center ${bold ? 'text-white/40' : 'text-[#9ca3af]'}`}>
                No songs found.
              </p>
            ) : displaySongs.map((song, i) => {
              const key = `${song.title}-${i}`;
              const isSelected = selected.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(key)) next.delete(key); else next.add(key);
                    return next;
                  })}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${bold ? 'hover:bg-white/10' : 'hover:bg-[#f9fafb]'}`}
                >
                  <span className={`flex-shrink-0 h-5 w-5 rounded border flex items-center justify-center transition-colors ${isSelected ? (bold ? 'bg-white border-white' : 'bg-[#1a1a1a] border-[#1a1a1a]') : (bold ? 'border-white/30 bg-transparent' : 'border-[#d1d5db] bg-transparent')}`}>
                    {isSelected && <Check className={`h-3 w-3 ${bold ? 'text-[#1a1a1a]' : 'text-white'}`} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`text-sm ${bold ? 'text-white' : 'text-[#1a1a1a]'}`}>{song.title}</span>
                    <span className={`text-sm ${bold ? 'text-white/50' : 'text-[#9ca3af]'}`}> — {song.artist}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {selected.size > 0 && (
            <p className={`text-sm ${bold ? 'text-white/60' : 'text-[#6b7280]'}`}>
              {selected.size} song{selected.size !== 1 ? 's' : ''} selected
            </p>
          )}
        </section>

        {/* 2. Key moments */}
        <section className="space-y-4">
          <h2 className={`text-base font-semibold ${bold ? 'text-white' : 'text-[#1a1a1a]'}`}>
            Key moments
          </h2>
          <div className="space-y-5">
            {Array.from(sectionMap.entries()).map(([section, items]) => (
              <div key={section}>
                <p className={sectionHeadingClass}>{section}</p>
                <div className="space-y-3">
                  {items.map((km) => (
                    <div key={km.label}>
                      <label className={`block text-sm mb-1.5 ${bold ? 'text-white/80' : 'text-[#374151]'}`}>
                        {km.label}
                      </label>
                      <input
                        type="text"
                        placeholder="Search songs or type a request…"
                        className={inputClass}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3. Notes */}
        <section className="space-y-2">
          <h2 className={`text-base font-semibold ${bold ? 'text-white' : 'text-[#1a1a1a]'}`}>Notes</h2>
          <textarea
            rows={3}
            placeholder="Any other requests or special instructions…"
            className={inputClass}
          />
        </section>

        <button
          type="button"
          disabled
          className="w-full rounded-lg px-5 py-3 text-sm font-medium text-white transition-opacity disabled:opacity-50"
          style={{ backgroundColor: brand }}
        >
          Submit requests
        </button>
      </div>
    </PortalLayout>
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

type PreviewPage = 'booking' | 'contract' | 'music';

const PAGE_TABS: { value: PreviewPage; label: string }[] = [
  { value: 'booking', label: 'Booking' },
  { value: 'contract', label: 'Contract' },
  { value: 'music', label: 'Music form' },
];

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
  const [previewPage, setPreviewPage] = useState<PreviewPage>('booking');

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
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors flex-shrink-0"
        >
          <ChevronLeft size={14} />
          Settings
        </Link>

        {/* Page tabs */}
        <div className="flex gap-0.5 bg-accent rounded-md p-0.5">
          {PAGE_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setPreviewPage(tab.value)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded transition-colors',
                previewPage === tab.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
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
        {previewPage === 'booking' && (
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
              <PreviewBookingView
                profile={previewProfile}
                bold={boldTheme}
                onNavigate={setPreviewPage}
              />
              <div className="mt-8 md:mt-0 md:sticky md:top-8">
                <ContactCard profile={previewProfile} bold={boldTheme} />
              </div>
            </div>
          </PortalLayout>
        )}

        {previewPage === 'contract' && (
          <PreviewContractView profile={previewProfile} bold={boldTheme} />
        )}

        {previewPage === 'music' && (
          <PreviewMusicView profile={previewProfile} bold={boldTheme} />
        )}
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
