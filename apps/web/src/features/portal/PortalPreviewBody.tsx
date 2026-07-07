import { useState } from 'react';
import { Check, Download, FileText, Music, Search } from 'lucide-react';
import { PortalLayout, getDisplayFontClass } from '@/layouts/PortalLayout';
import {
  LightGreeting,
  BoldHero,
  ContactCard,
  SetsCard,
  bookingStatusMessage,
} from '@/pages/portal/PortalPage';
import { SignatureSection } from '@/pages/portal/PortalContractPage';
import { type Overrides } from '@/features/portal/CustomiseSheet';
import { usePortalTheme } from '@/features/portal/usePortalTheme';
import type { PublicProfile, PortalPublicProfile, ClientPortalConfig } from '@/types/api';

// ─── Mock data ────────────────────────────────────────────────────────────────

const PREVIEW_DATE = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
const PREVIEW_FORMATTED_DATE = PREVIEW_DATE.toLocaleDateString('en-GB', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
});

const PREVIEW_SETS = [
  { order: 0, label: null, startTime: '4:00 pm', duration: 60, packageId: 'fmt1' },
  { order: 1, label: null, startTime: '7:00 pm', duration: 45, packageId: 'fmt2' },
  { order: 2, label: 'Set 1', startTime: '8:30 pm', duration: 60, packageId: 'fmt3' },
  { order: 3, label: 'Set 2', startTime: '10:00 pm', duration: 60, packageId: 'fmt3' },
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

// ─── Overrides ⇄ profile ──────────────────────────────────────────────────────

export function profileToOverrides(p: PublicProfile): Overrides {
  const cfg: Partial<ClientPortalConfig> = p.clientPortalConfig ?? {};
  return {
    theme: cfg.theme ?? 'LIGHT_MODERN',
    brandColour: cfg.brandColour ?? '#1a1a1a',
    heroImage: cfg.heroImage ?? null,
    showContactPhoto: cfg.showContactPhoto ?? false,
    showContactEmail: cfg.showContactEmail ?? true,
    showContactPhone: cfg.showContactPhone ?? false,
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
  onNavigate,
}: {
  profile: PortalPublicProfile;
  onNavigate: (page: PreviewPage) => void;
}) {
  const brand = profile.brandColour ?? '#1a1a1a';
  const t = usePortalTheme(profile.portalTheme ?? 'LIGHT_MODERN');

  return (
    <div className="space-y-5">
      <div className={t.card}>
        <div className="flex justify-between items-baseline text-sm gap-4">
          <span className={t.rowLabelClass}>Date</span>
          <span className={`font-medium ${t.primaryText}`}>{PREVIEW_FORMATTED_DATE}</span>
        </div>
        <div className="flex justify-between items-baseline text-sm gap-4">
          <span className={t.rowLabelClass}>Venue</span>
          <span className={`font-medium ${t.primaryText} text-right`}>{PREVIEW_VENUE}</span>
        </div>
        <div className="flex justify-between items-baseline text-sm gap-4">
          <span className={t.rowLabelClass}>Fee</span>
          <span className={`font-medium ${t.primaryText}`}>£{PREVIEW_FEE}</span>
        </div>
      </div>

      <SetsCard sets={PREVIEW_SETS} formats={PREVIEW_FORMATS} bold={t.bold} />

      <button type="button" onClick={() => onNavigate('contract')} className={t.ctaClass} style={t.ctaStyle(brand)}>
        <FileText className="h-4 w-4" />
        Review &amp; sign contract
      </button>

      <button type="button" onClick={() => onNavigate('music')} className={t.ctaClass} style={t.ctaStyle(brand)}>
        <Music className="h-4 w-4" />
        Choose your songs
      </button>

      <div className="space-y-2 pt-1">
        <p className={`text-xs font-medium uppercase tracking-wide ${t.sectionLabel}`}>
          Documents
        </p>
        <div className={`rounded-lg divide-y ${t.docList}`}>
          {PREVIEW_DOCUMENTS.map((doc) => (
            <div
              key={doc.label}
              className={`flex items-center gap-3 px-4 py-3 text-sm ${t.primaryText}`}
            >
              <FileText className={`h-4 w-4 flex-shrink-0 ${t.iconSubtle}`} />
              <span className="flex-1 min-w-0 truncate">{doc.label}</span>
              <Download className={`h-3.5 w-3.5 flex-shrink-0 ${t.iconSubtle}`} />
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
}: {
  profile: PortalPublicProfile;
}) {
  const brand = profile.brandColour ?? '#1a1a1a';
  const displayFont = getDisplayFontClass(profile.portalTheme);
  const t = usePortalTheme(profile.portalTheme ?? 'LIGHT_MODERN');
  const [agreed, setAgreed] = useState(false);

  return (
    <PortalLayout profile={profile}>
      <div className="space-y-8">
        <div>
          <h1 className={`${displayFont} text-3xl mb-1 ${t.primaryText}`}>
            Performance Agreement
          </h1>
          <p className={`text-sm ${t.mutedText}`}>
            Please read carefully before signing
          </p>
        </div>

        <div className={`rounded-lg p-6 space-y-4 ${t.contentBox}`}>
          <p className={`text-sm leading-relaxed ${t.subtleText}`}>
            This Performance Agreement is entered into between <strong>{profile.businessName}</strong> ("Performer") and Sarah &amp; James Anderson ("Client") for the event <em>{PREVIEW_TITLE}</em> on {PREVIEW_FORMATTED_DATE} at {PREVIEW_VENUE}.
          </p>
          <p className={`text-sm leading-relaxed ${t.subtleText}`}>
            <strong>1. Services.</strong> The Performer agrees to provide live musical entertainment for the event as outlined in the booking details, including all agreed sets and formats.
          </p>
          <p className={`text-sm leading-relaxed ${t.subtleText}`}>
            <strong>2. Fee.</strong> The agreed performance fee is £{PREVIEW_FEE}. A deposit is payable upon signing, with the balance due no later than 7 days before the event date.
          </p>
          <p className={`text-sm leading-relaxed ${t.subtleText}`}>
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
            <span className={`text-sm ${t.formText}`}>
              I have read and agree to the terms above
            </span>
          </label>

          {agreed && (
            <div className="space-y-3">
              <p className={`text-sm font-medium ${t.primaryText}`}>
                Sign below
              </p>
              <SignatureSection onSign={() => {}} brand={brand} isBold={t.bold} />
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
}: {
  profile: PortalPublicProfile;
}) {
  const brand = profile.brandColour ?? '#1a1a1a';
  const displayFont = getDisplayFontClass(profile.portalTheme);
  const t = usePortalTheme(profile.portalTheme ?? 'LIGHT_MODERN');
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

  // Group special requests by section
  const sectionMap = new Map<string, typeof PREVIEW_KEY_MOMENTS>();
  for (const km of PREVIEW_KEY_MOMENTS) {
    if (!sectionMap.has(km.section)) sectionMap.set(km.section, []);
    sectionMap.get(km.section)!.push(km);
  }

  return (
    <PortalLayout profile={profile}>
      <div className="space-y-8">
        <div>
          <h1 className={`${displayFont} text-3xl mb-1 ${t.primaryText}`}>
            Song requests
          </h1>
          <p className={`text-sm ${t.mutedText}`}>
            Choose songs you'd like to hear and pick something special for key moments.
          </p>
        </div>

        {/* 1. General requests */}
        <section className="space-y-4">
          <h2 className={`text-base font-semibold ${t.primaryText}`}>
            General requests
          </h2>

          {/* Search */}
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${t.iconMuted}`} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search all songs…"
              className={`${t.inputClass} pl-9`}
            />
          </div>

          {/* Genre tabs */}
          {!search.trim() && (
            <div className="flex flex-wrap gap-2">
              {genres.map((g) => (
                <button key={g} type="button" onClick={() => setActiveGenre(g)} className={t.genreClass(g === activeGenre)}>
                  {g}
                </button>
              ))}
            </div>
          )}

          {/* Song list */}
          <div className={`rounded-lg divide-y overflow-hidden ${t.songList}`}>
            {displaySongs.length === 0 ? (
              <p className={`px-4 py-6 text-sm text-center ${t.emptyText}`}>
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
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${t.songRowHover}`}
                >
                  <span className={`flex-shrink-0 h-5 w-5 rounded border flex items-center justify-center transition-colors ${isSelected ? t.checkboxSelected : t.checkboxUnselected}`}>
                    {isSelected && <Check className={`h-3 w-3 ${t.checkboxTick}`} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`text-sm ${t.primaryText}`}>{song.title}</span>
                    <span className={`text-sm ${t.artistText}`}> — {song.artist}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {selected.size > 0 && (
            <p className={`text-sm ${t.mutedText}`}>
              {selected.size} song{selected.size !== 1 ? 's' : ''} selected
            </p>
          )}
        </section>

        {/* 2. Special requests */}
        <section className="space-y-4">
          <h2 className={`text-base font-semibold ${t.primaryText}`}>
            Special requests
          </h2>
          <div className="space-y-5">
            {Array.from(sectionMap.entries()).map(([section, items]) => (
              <div key={section}>
                <p className={t.sectionHeadingClass}>{section}</p>
                <div className="space-y-3">
                  {items.map((km) => (
                    <div key={km.label}>
                      <label className={`block text-sm mb-1.5 ${t.formText}`}>
                        {km.label}
                      </label>
                      <input
                        type="text"
                        placeholder="Search songs or type a request…"
                        className={t.inputClass}
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
          <h2 className={`text-base font-semibold ${t.primaryText}`}>Notes</h2>
          <textarea
            rows={3}
            placeholder="Any other requests or special instructions…"
            className={t.inputClass}
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

// ─── Embeddable preview body ──────────────────────────────────────────────────

export type PreviewPage = 'booking' | 'contract' | 'music';

/**
 * The client-portal preview renderer, decoupled from the admin page chrome
 * (top bar, tabs, save). The container owns `previewPage` + navigation and the
 * `overrides` it derives from the profile; this body just renders the chosen
 * page against the live overrides. Shared by the admin preview route and
 * onboarding Step 4.
 */
export function PortalPreviewBody({
  profile,
  overrides,
  previewPage,
  onNavigate,
}: {
  profile: PublicProfile;
  overrides: Overrides;
  previewPage: PreviewPage;
  onNavigate: (page: PreviewPage) => void;
}) {
  const { bold: boldTheme } = usePortalTheme(overrides.theme);
  const previewProfile = buildPreviewProfile(profile, overrides);
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

  if (previewPage === 'contract') {
    return <PreviewContractView profile={previewProfile} />;
  }

  if (previewPage === 'music') {
    return <PreviewMusicView profile={previewProfile} />;
  }

  return (
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
          onNavigate={onNavigate}
        />
        <div className="mt-8 md:mt-0 md:sticky md:top-8">
          <ContactCard profile={previewProfile} bold={boldTheme} />
        </div>
      </div>
    </PortalLayout>
  );
}
