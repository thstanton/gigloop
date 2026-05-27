import { useParams, Link, useSearchParams } from 'react-router-dom';
import { PreviewBanner } from './PreviewBanner';
import { useQuery } from '@tanstack/react-query';
import { FileText, Download, CheckCircle, Clock, Music, Music2, ClipboardCheck, Mail, Phone, Heart, GlassWater, Utensils, Moon, Briefcase } from 'lucide-react';
import { getPortalData } from '../../lib/portalApi';
import { PortalLayout, getDisplayFontClass, isRomantic } from '../../layouts/PortalLayout';
import type { PortalData, PortalDocument, PortalPublicProfile, PortalBookingSet, PortalBookingFormat } from '../../types/api';

// ─── Colour utilities ─────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Returns the text colour (white or near-black) with the better WCAG contrast
// against the given background hex. Threshold ~0.208 is the crossover point
// where white and #1a1a1a have equal contrast ratios.
export function pickTextColour(bgHex: string): '#ffffff' | '#1a1a1a' {
  return relativeLuminance(bgHex) < 0.208 ? '#ffffff' : '#1a1a1a';
}

// ─── Format icon map (mirrors admin PerformanceSection) ───────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FORMAT_ICON_MAP: Record<string, React.ComponentType<any>> = {
  heart: Heart,
  'glass-water': GlassWater,
  utensils: Utensils,
  moon: Moon,
  briefcase: Briefcase,
  music: Music,
  'music-2': Music2,
};

// ─── Status message ───────────────────────────────────────────────────────────

export function bookingStatusMessage(status: string): string {
  switch (status) {
    case 'ENQUIRY':   return 'Confirm your booking';
    case 'CONFIRMED': return 'Your booking is confirmed';
    case 'INVOICED':  return 'Your booking is confirmed';
    case 'SETTLED':   return "You're all set";
    case 'COMPLETED': return 'Thanks for your booking!';
    case 'CANCELLED': return 'This booking has been cancelled';
    default:          return '';
  }
}

// ─── Contact card ─────────────────────────────────────────────────────────────

export function ContactCard({ profile, bold }: { profile: PortalPublicProfile; bold: boolean }) {
  const contactName = profile.displayName ?? profile.businessName;
  const showPhoto = profile.showContactPhoto && !!profile.photo;

  return (
    <div className={`rounded-lg p-5 space-y-3 ${bold ? 'bg-white/15' : 'bg-[#f5f2ed]'}`}>
      <p className={`text-xs font-medium uppercase tracking-wide ${bold ? 'text-white/50' : 'text-[#a39e97]'}`}>
        Get in touch
      </p>
      <div className="flex items-center gap-3">
        {showPhoto && (
          <img
            src={profile.photo!}
            alt={contactName}
            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
          />
        )}
        <p className={`font-semibold ${bold ? 'text-white' : 'text-[#1a1a1a]'}`}>{contactName}</p>
      </div>
      {profile.showContactEmail && profile.email && (
        <a
          href={`mailto:${profile.email}`}
          className={`flex items-center gap-2 text-sm transition-colors ${bold ? 'text-white/75 hover:text-white' : 'text-[#5a544e] hover:text-[#1a1a1a]'}`}
        >
          <Mail className="h-3.5 w-3.5 flex-shrink-0" />
          {profile.email}
        </a>
      )}
      {profile.showContactPhone && profile.phone && (
        <a
          href={`tel:${profile.phone}`}
          className={`flex items-center gap-2 text-sm transition-colors ${bold ? 'text-white/75 hover:text-white' : 'text-[#5a544e] hover:text-[#1a1a1a]'}`}
        >
          <Phone className="h-3.5 w-3.5 flex-shrink-0" />
          {profile.phone}
        </a>
      )}
    </div>
  );
}

// ─── LIGHT greeting (full-width, above the two-column grid) ───────────────────

export function LightGreeting({ greetingName, title, statusMessage, theme }: {
  greetingName: string;
  title: string | null;
  statusMessage: string;
  theme: string | null;
}) {
  const displayFont = getDisplayFontClass(theme);
  const romantic = isRomantic(theme);

  return (
    <div className="mb-10">
      <h1 className={`${displayFont} ${romantic ? 'text-5xl' : 'text-4xl font-light'} text-[#1a1a1a] leading-tight mb-2`}>
        {romantic ? `Hello, ${greetingName}!` : `Hello, ${greetingName}.`}
      </h1>
      {title && (
        <p className="text-base text-[#9a9189] mb-1">{title}</p>
      )}
      {statusMessage && (
        <p className="text-base text-[#5a544e]">{statusMessage}</p>
      )}
    </div>
  );
}

// ─── BOLD hero ────────────────────────────────────────────────────────────────

export function BoldHero({ greetingName, title, formattedDate, statusMessage, portalHeroImage, theme, brand }: {
  greetingName: string;
  title: string | null;
  formattedDate: string;
  statusMessage: string;
  portalHeroImage: string | null;
  theme: string | null;
  brand: string;
}) {
  const displayFont = getDisplayFontClass(theme);
  const romantic = isRomantic(theme);

  return (
    <div
      className="relative overflow-hidden min-h-[280px] md:min-h-[320px]"
      style={!portalHeroImage ? { backgroundColor: brand } : undefined}
    >
      {portalHeroImage && (
        <img
          src={`/${portalHeroImage}.png`}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          background: portalHeroImage
            ? `linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0.15) 100%)`
            : `linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.65) 100%)`,
        }}
      />
      <div className="relative z-10 max-w-4xl mx-auto px-6 pt-12 pb-10">
        <h1 className={`${displayFont} ${romantic ? 'text-5xl' : 'text-4xl font-semibold'} text-white leading-tight mb-2`}>
          {romantic ? `Hello, ${greetingName}!` : (title ?? `Hello, ${greetingName}.`)}
        </h1>
        {romantic && title && (
          <p className="text-white/80 text-base mb-1">{title}</p>
        )}
        <p className="text-white/55 text-sm">{formattedDate}</p>
        {statusMessage && (
          <p className="text-white/80 text-base mt-2">{statusMessage}</p>
        )}
      </div>
    </div>
  );
}

// ─── Sets card ────────────────────────────────────────────────────────────────

export function SetsCard({ sets, formats, bold }: { sets: PortalBookingSet[]; formats: PortalBookingFormat[]; bold: boolean }) {
  if (sets.length === 0) return null;

  const setsByFormatId = new Map<string | null, PortalBookingSet[]>();
  for (const s of sets) {
    const key = s.performanceFormatId ?? null;
    if (!setsByFormatId.has(key)) setsByFormatId.set(key, []);
    setsByFormatId.get(key)!.push(s);
  }
  const unassigned = setsByFormatId.get(null) ?? [];

  const mutedClass = bold ? 'text-white/50' : 'text-[#a39e97]';
  const labelClass = bold ? 'text-white' : 'text-[#1a1a1a]';
  const headingClass = bold ? 'text-white/85' : 'text-[#5a544e]';
  const iconClass = bold ? 'text-white/55 flex-shrink-0' : 'text-[#9a9189] flex-shrink-0';
  const dividerClass = bold ? 'divide-white/10' : 'divide-[#ede9e4]';
  const borderClass = bold ? 'border-white/10' : 'border-[#ede9e4]';

  return (
    <div className={`rounded-lg overflow-hidden ${bold ? 'bg-white/15' : 'bg-[#f5f2ed]'}`}>
      <div className={`px-5 py-3 border-b ${borderClass}`}>
        <p className={`text-xs font-medium uppercase tracking-wide ${mutedClass}`}>
          Programme
        </p>
      </div>

      <div className={`divide-y ${dividerClass}`}>
        {formats.map((fmt) => {
          const fmtSets = setsByFormatId.get(fmt.id) ?? [];
          if (fmtSets.length === 0) return null;
          const Icon = FORMAT_ICON_MAP[fmt.icon] ?? Music;

          if (fmtSets.length === 1) {
            // Single set: merge into one row — icon + format label + duration, time on right
            const s = fmtSets[0];
            return (
              <div key={fmt.id} className="flex items-center justify-between px-5 py-3 gap-4">
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon size={14} className={iconClass} />
                  <span className={`text-sm font-medium ${headingClass}`}>{fmt.label}</span>
                  {s.duration != null && (
                    <span className={`text-sm ${mutedClass}`}>· {s.duration} min</span>
                  )}
                </span>
                {s.startTime && (
                  <span className={`text-sm flex-shrink-0 font-medium ${labelClass}`}>{s.startTime}</span>
                )}
              </div>
            );
          }

          // Multiple sets: header row then tightly-spaced set rows, no internal borders
          return (
            <div key={fmt.id}>
              <div className="flex items-center gap-2.5 px-5 pt-3 pb-1">
                <Icon size={14} className={iconClass} />
                <span className={`text-sm font-medium ${headingClass}`}>{fmt.label}</span>
              </div>
              <div className="pb-2">
                {fmtSets.map((s) => (
                  <div key={s.order} className="flex items-center justify-between pl-9 pr-5 py-1.5 gap-4">
                    <span className={`text-sm ${labelClass}`}>
                      {s.label ?? `Set ${s.order + 1}`}
                      {s.duration != null && (
                        <span className={`ml-1.5 ${mutedClass}`}>· {s.duration} min</span>
                      )}
                    </span>
                    {s.startTime && (
                      <span className={`text-sm flex-shrink-0 ${mutedClass}`}>{s.startTime}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {unassigned.map((s) => (
          <div key={s.order} className="flex items-center justify-between px-5 py-3 gap-4">
            <span className={`text-sm ${labelClass}`}>
              {s.label ?? `Set ${s.order + 1}`}
              {s.duration != null && (
                <span className={`ml-1.5 ${mutedClass}`}>· {s.duration} min</span>
              )}
            </span>
            {s.startTime && (
              <span className={`text-sm flex-shrink-0 ${mutedClass}`}>{s.startTime}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Booking summary ──────────────────────────────────────────────────────────

function BookingSummary({ data, musicSuccess, isPreview, previewFrom }: {
  data: PortalData;
  musicSuccess: boolean;
  isPreview?: boolean;
  previewFrom?: string;
}) {
  const { booking, publicProfile } = data;
  const brand = publicProfile.brandColour ?? '#1a1a1a';
  const bold = publicProfile.portalTheme === 'BOLD_MODERN' || publicProfile.portalTheme === 'BOLD_ROMANTIC';

  const formattedDate = new Date(booking.date).toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const labelClass = bold
    ? 'text-white/50'
    : 'text-[#a39e97] text-xs uppercase tracking-wide font-medium';

  const valueClass = `font-medium ${bold ? 'text-white' : 'text-[#1a1a1a]'}`;

  const cardClass = bold ? 'rounded-lg px-5 py-5 space-y-3.5 bg-white/15' : 'rounded-lg px-6 py-5 space-y-4 bg-[#f5f2ed]';

  const bannerBase = 'flex items-start gap-3 rounded-lg p-4 text-sm';

  const ctaClass = bold
    ? 'flex items-center justify-center gap-2 w-full rounded-lg px-5 py-3.5 text-sm font-medium transition-opacity hover:opacity-90'
    : 'flex items-center justify-center gap-2 w-full rounded-lg px-5 py-3.5 text-sm font-medium transition-colors border hover:bg-[#f5f2ed]';

  const ctaStyle = bold
    ? { backgroundColor: brand, color: pickTextColour(brand) }
    : { borderColor: brand, color: brand };

  return (
    <div className="space-y-5">
      {/* Booking details card — date, venue, fee (sets moved to SetsCard below) */}
      <div className={cardClass}>
        <div className="flex justify-between items-baseline text-sm gap-4">
          <span className={labelClass}>Date</span>
          <span className={valueClass}>{formattedDate}</span>
        </div>
        {booking.venueName && (
          <div className="flex justify-between items-baseline text-sm gap-4">
            <span className={labelClass}>Venue</span>
            <span className={`${valueClass} text-right`}>{booking.venueName}</span>
          </div>
        )}
        {booking.fee != null && (
          <div className="flex justify-between items-baseline text-sm gap-4">
            <span className={labelClass}>Fee</span>
            <span className={valueClass}>£{booking.fee}</span>
          </div>
        )}
      </div>

      {/* Sets — separate card, grouped by format with icons */}
      <SetsCard sets={booking.sets} formats={booking.formats} bold={bold} />

      {/* Deposit due banner */}
      {data.depositInvoiceDueDate && !booking.contractSignedAt && (
        <div className={`${bannerBase} ${bold ? 'bg-white/15' : 'bg-amber-50 border-l-2 border-amber-300'}`}>
          <Clock className={`mt-0.5 h-4 w-4 flex-shrink-0 ${bold ? 'text-white/55' : 'text-amber-500'}`} />
          <span className={bold ? 'text-white/75' : 'text-amber-900 text-sm'}>
            Deposit due by {new Date(data.depositInvoiceDueDate).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </span>
        </div>
      )}

      {/* Contract signed / CTA */}
      {booking.contractSignedAt ? (
        <div className={`${bannerBase} ${bold ? 'bg-white/15' : 'bg-green-50 border-l-2 border-green-400'}`}>
          <CheckCircle className={`h-4 w-4 flex-shrink-0 mt-0.5 ${bold ? 'text-green-400' : 'text-green-600'}`} />
          <span className={bold ? 'text-white/75 text-sm' : 'text-green-900 text-sm'}>
            Contract signed {new Date(booking.contractSignedAt).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </span>
        </div>
      ) : data.hasContractEmail ? (
        <Link
          to={isPreview ? `contract?preview=admin&from=${encodeURIComponent(previewFrom ?? '')}` : 'contract'}
          className={ctaClass}
          style={ctaStyle}
        >
          <FileText className="h-4 w-4" />
          Review &amp; sign contract
        </Link>
      ) : null}

      {/* Music success banner */}
      {musicSuccess && (
        <div className={`${bannerBase} ${bold ? 'bg-white/15' : 'bg-green-50 border-l-2 border-green-400'}`}>
          <ClipboardCheck className={`h-4 w-4 flex-shrink-0 mt-0.5 ${bold ? 'text-green-400' : 'text-green-600'}`} />
          <span className={bold ? 'text-white/75 text-sm' : 'text-green-900 text-sm'}>
            Song requests submitted — thank you!
          </span>
        </div>
      )}

      {/* Music form */}
      {data.hasMusicForm && (
        data.hasMusicFormResponse && !musicSuccess ? (
          <div className={`${bannerBase} ${bold ? 'bg-white/15' : 'bg-[#f5f2ed]'}`}>
            <ClipboardCheck className={`h-4 w-4 flex-shrink-0 mt-0.5 ${bold ? 'text-green-400' : 'text-green-600'}`} />
            <span className={bold ? 'text-white/75 text-sm' : 'text-[#5a544e] text-sm'}>
              Song requests submitted
            </span>
            <Link
              to={isPreview ? `music?preview=admin&from=${encodeURIComponent(previewFrom ?? '')}` : 'music'}
              className={`ml-auto text-xs underline underline-offset-2 ${bold ? 'text-white/45 hover:text-white' : 'text-[#a39e97] hover:text-[#1a1a1a]'}`}
            >
              Update
            </Link>
          </div>
        ) : !data.hasMusicFormResponse ? (
          <Link
            to={isPreview ? `music?preview=admin&from=${encodeURIComponent(previewFrom ?? '')}` : 'music'}
            className={ctaClass}
            style={ctaStyle}
          >
            <Music className="h-4 w-4" />
            Choose your songs
          </Link>
        ) : null
      )}

      {/* Documents */}
      {data.documents.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className={`text-xs font-medium uppercase tracking-wide ${bold ? 'text-white/35' : 'text-[#a39e97]'}`}>
            Documents
          </p>
          <div className={`rounded-lg divide-y ${bold ? 'divide-white/10 bg-white/15' : 'divide-[#ede9e4] bg-[#f5f2ed]'}`}>
            {data.documents.map((doc: PortalDocument) => (
              <a
                key={doc.id}
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-3 px-4 py-3 text-sm transition-opacity hover:opacity-70 ${bold ? 'text-white' : 'text-[#1a1a1a]'}`}
              >
                <FileText className={`h-4 w-4 flex-shrink-0 ${bold ? 'text-white/35' : 'text-[#b0a89c]'}`} />
                <span className="flex-1 min-w-0 truncate">{doc.label}</span>
                <Download className={`h-3.5 w-3.5 flex-shrink-0 ${bold ? 'text-white/35' : 'text-[#b0a89c]'}`} />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortalPage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const musicSuccess = searchParams.get('music') === '1';
  const isPreview = searchParams.get('preview') === 'admin';
  const previewFrom = searchParams.get('from') ?? '/admin/bookings';

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['portal', token],
    queryFn: () => getPortalData(token!),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-pulse text-[#9ca3af] text-sm">Loading…</div>
      </div>
    );
  }

  if (isError || !data) {
    const status = error instanceof Response ? error.status : 0;
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="text-center max-w-sm">
          <FileText className="mx-auto mb-4 h-10 w-10 text-[#9ca3af]" />
          <h1 className="text-lg font-semibold text-[#1a1a1a] mb-2">
            {status === 404 ? 'Booking not found' : 'Something went wrong'}
          </h1>
          <p className="text-sm text-[#6b7280]">
            {status === 404
              ? 'This link may be incorrect or has expired. Please contact the musician directly.'
              : 'Please try again or contact the musician directly.'}
          </p>
        </div>
      </div>
    );
  }

  const { publicProfile, booking } = data;
  const boldTheme = publicProfile.portalTheme === 'BOLD_MODERN' || publicProfile.portalTheme === 'BOLD_ROMANTIC';
  const greetingName = booking.customerGreetingName ?? booking.customerName;
  const formattedDate = new Date(booking.date).toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const brand = publicProfile.brandColour ?? '#1a1a1a';
  const statusMessage = bookingStatusMessage(booking.status);

  const hero = boldTheme ? (
    <BoldHero
      greetingName={greetingName}
      title={booking.title}
      formattedDate={formattedDate}
      statusMessage={statusMessage}
      portalHeroImage={publicProfile.portalHeroImage}
      theme={publicProfile.portalTheme}
      brand={brand}
    />
  ) : undefined;

  return (
    <>
      {isPreview && <PreviewBanner customerName={booking.customerName} backHref={previewFrom} />}
      <PortalLayout profile={publicProfile} wide hero={hero}>
        {/* LIGHT: greeting spans full width above the two-column grid */}
        {!boldTheme && (
          <LightGreeting
            greetingName={greetingName}
            title={booking.title}
            statusMessage={statusMessage}
            theme={publicProfile.portalTheme}
          />
        )}
        <div className="md:grid md:grid-cols-[1fr_280px] md:gap-8 md:items-start">
          <BookingSummary data={data} musicSuccess={musicSuccess} isPreview={isPreview} previewFrom={previewFrom} />
          <div className="mt-8 md:mt-0 md:sticky md:top-8">
            <ContactCard profile={publicProfile} bold={boldTheme} />
          </div>
        </div>
      </PortalLayout>
    </>
  );
}
