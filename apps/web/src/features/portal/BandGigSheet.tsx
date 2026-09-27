import { CalendarDays, MapPin, Music, AlertTriangle, Mail, Phone, Download } from 'lucide-react';
import { PortalLayout } from '../../layouts/PortalLayout';
import { usePortalTheme } from './usePortalTheme';
import { BandResponseBar, type BandResponseValue } from './BandResponseBar';
import { Card } from '@/components/common/Card';
import { LabelValue } from '@/components/common/LabelValue';
import { Badge } from '@/components/ui/badge';
import { PACKAGE_ICON_MAP, LOGISTICS_FIELD_LABELS } from '@/lib/constants';
import { getBandCallSheetUrl } from '@/lib/portalApi';
import type { BandPortalData, BandPortalRosterChair, BandPortalRosterView, BandPortalSelfView } from '@/types/api';

function logisticsLabel(key: string): string {
  return (LOGISTICS_FIELD_LABELS as Record<string, string>)[key] ?? key;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatVenueAddress(address: BandPortalRosterView['venueAddress']): string | null {
  if (!address) return null;
  return [address.line1, address.line2, address.city, address.county, address.postcode, address.country]
    .filter((part): part is string => !!part)
    .join(', ');
}

// GigIdentity and the cancelled banner sit directly on the branded PortalLayout background (not
// inside a Card), so — unlike the body sections below — they need `usePortalTheme`'s text classes
// rather than the admin app's light-mode `text-foreground`/`text-muted`, which would render
// dark-on-dark under a BOLD theme's `#2a2a2a` shell.
function GigIdentity({ roster, theme }: { roster: BandPortalRosterView; theme: ReturnType<typeof usePortalTheme> }) {
  const addressLine = formatVenueAddress(roster.venueAddress);
  return (
    <div className="mb-6 space-y-2">
      <h1 className={`text-xl font-semibold ${theme.primaryText}`}>{roster.bookingTitle ?? 'Gig details'}</h1>
      <p className={`flex items-center gap-2 text-base ${theme.mutedText}`}>
        <CalendarDays className="h-4 w-4 flex-shrink-0" />
        {formatDate(roster.bookingDate)}
      </p>
      {roster.venueName && (
        <p className={`flex items-start gap-2 text-base ${theme.mutedText}`}>
          <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>
            {roster.venueName}
            {addressLine && <span className="block text-base">{addressLine}</span>}
          </span>
        </p>
      )}
    </div>
  );
}

// The call sheet download (#893, ADR-0073 §4) — generated on demand, current by construction, so
// a plain link is enough: no fetch-then-blob dance, no loading state to track.
function CallSheetLink({ token, theme }: { token: string; theme: ReturnType<typeof usePortalTheme> }) {
  return (
    <a
      href={getBandCallSheetUrl(token)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 text-base font-medium ${theme.primaryText} mb-6`}
    >
      <Download className="h-4 w-4" />
      Download call sheet
    </a>
  );
}

function SetRow({ set, indented }: { set: BandPortalRosterView['sets'][number]; indented: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 text-base ${indented ? 'pl-6' : 'px-4 py-3'}`}>
      <span className="text-foreground">{set.label ?? `Set ${set.order + 1}`}</span>
      {set.startTime && <span className="text-muted">{set.startTime}</span>}
    </div>
  );
}

function RunningOrder({ roster }: { roster: BandPortalRosterView }) {
  if (roster.sets.length === 0) return null;
  const bySegment = new Map<string | null, BandPortalRosterView['sets']>();
  for (const set of roster.sets) {
    const key = set.packageId;
    if (!bySegment.has(key)) bySegment.set(key, []);
    bySegment.get(key)!.push(set);
  }

  return (
    <Card title="Running order" className="mb-4">
      <div className="divide-y divide-border -mx-4">
        {roster.segments.map((segment) => {
          const sets = bySegment.get(segment.id) ?? [];
          if (sets.length === 0) return null;
          const Icon = PACKAGE_ICON_MAP[segment.icon] ?? Music;
          return (
            <div key={segment.id} className="px-4 py-3">
              <p className="flex items-center gap-2 text-base font-medium text-foreground mb-1">
                <Icon size={14} className="text-muted flex-shrink-0" />
                {segment.label}
              </p>
              {sets.map((set) => (
                <SetRow key={set.order} set={set} indented />
              ))}
            </div>
          );
        })}
        {(bySegment.get(null) ?? []).map((set) => (
          <SetRow key={set.order} set={set} indented={false} />
        ))}
      </div>
    </Card>
  );
}

function ChairRow({ chair, isOwn }: { chair: BandPortalRosterChair; isOwn: boolean }) {
  return (
    <div
      className={`flex items-start justify-between gap-4 px-4 py-3 ${isOwn ? 'bg-primary/5' : ''}`}
      data-testid={isOwn ? 'own-chair-row' : undefined}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{chair.role}</Badge>
          {isOwn && <Badge>You</Badge>}
        </div>
        <p className="mt-1 text-base text-foreground">{chair.memberName ?? 'Vacant'}</p>
      </div>
      {chair.callTimes.length > 0 && (
        <div className="text-right text-base text-muted flex-shrink-0">
          {chair.callTimes.map((ct) => (
            <div key={`${ct.segmentId ?? 'whole-day'}`}>{ct.startTime}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function Roster({ roster, self }: { roster: BandPortalRosterView; self: BandPortalSelfView }) {
  if (roster.chairs.length === 0) return null;
  return (
    <Card title="Band" className="mb-4">
      <div className="divide-y divide-border -mx-4">
        {roster.chairs.map((chair) => (
          <ChairRow key={chair.id} chair={chair} isOwn={self.ownChairIds.includes(chair.id)} />
        ))}
      </div>
    </Card>
  );
}

function YourDetails({ self }: { self: BandPortalSelfView }) {
  return (
    <Card title="Your details" className="mb-4">
      <LabelValue label="Status">
        <Badge variant="outline">{self.status}</Badge>
      </LabelValue>
      {self.sessionFee != null && <LabelValue label="Your fee">£{self.sessionFee}</LabelValue>}
    </Card>
  );
}

function Logistics({ roster }: { roster: BandPortalRosterView }) {
  if (roster.logistics.length === 0) return null;
  return (
    <Card title="On the day" className="mb-4">
      {roster.logistics.map((entry) => (
        <LabelValue key={entry.key} label={logisticsLabel(entry.key)}>
          {entry.value}
        </LabelValue>
      ))}
    </Card>
  );
}

function OrganiserContact({ branding }: { branding: BandPortalData['branding'] }) {
  if (!branding.email && !branding.phone) return null;
  return (
    <Card title="Get in touch">
      <p className="font-medium text-foreground mb-2">{branding.displayName ?? branding.businessName}</p>
      {branding.email && (
        <a href={`mailto:${branding.email}`} className="flex items-center gap-2 text-base text-muted hover:text-foreground">
          <Mail className="h-3.5 w-3.5 flex-shrink-0" />
          {branding.email}
        </a>
      )}
      {branding.phone && (
        <a href={`tel:${branding.phone}`} className="flex items-center gap-2 text-base text-muted hover:text-foreground mt-1">
          <Phone className="h-3.5 w-3.5 flex-shrink-0" />
          {branding.phone}
        </a>
      )}
    </Card>
  );
}

function CancelledBanner({ theme }: { theme: ReturnType<typeof usePortalTheme> }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-lg p-4 text-base ${
        theme.bold ? 'bg-white/15' : 'bg-amber-50 border-l-2 border-amber-300'
      }`}
    >
      <AlertTriangle className={`mt-0.5 h-4 w-4 flex-shrink-0 ${theme.bold ? 'text-white/75' : 'text-amber-500'}`} />
      <span className={theme.bold ? 'text-white/75' : 'text-amber-900'}>This gig has been cancelled.</span>
    </div>
  );
}

interface BandGigSheetProps {
  data: BandPortalData;
  token: string;
  onConfirm: () => void;
  onDecline: () => void;
  pendingResponse: BandResponseValue | null;
}

export function BandGigSheet({ data, token, onConfirm, onDecline, pendingResponse }: BandGigSheetProps) {
  // Keeps the hero/greeting text consistent with the client portal's own brand-driven palette
  // (ADR-0073's "do not fork the client portal's shell"); the body Cards below deliberately use the
  // app's standard Card/Badge/LabelValue primitives instead — a gig sheet reads as a working
  // document, not a marketing surface.
  const theme = usePortalTheme(data.branding.portalTheme);

  return (
    <PortalLayout profile={data.branding} wide>
      {data.cancelled ? (
        <CancelledBanner theme={theme} />
      ) : (
        <>
          {/* pb-24 reserves room for the fixed response bar below, so it never covers the last card. */}
          <div className="md:grid md:grid-cols-[1fr_280px] md:gap-8 md:items-start pb-24">
            <div>
              <GigIdentity roster={data.roster} theme={theme} />
              <CallSheetLink token={token} theme={theme} />
              <YourDetails self={data.self} />
              <RunningOrder roster={data.roster} />
              <Roster roster={data.roster} self={data.self} />
              <Logistics roster={data.roster} />
            </div>
            <div className="mt-8 md:mt-0 md:sticky md:top-8">
              <OrganiserContact branding={data.branding} />
            </div>
          </div>
          <BandResponseBar
            status={data.self.status}
            onConfirm={onConfirm}
            onDecline={onDecline}
            pendingResponse={pendingResponse}
          />
        </>
      )}
    </PortalLayout>
  );
}
