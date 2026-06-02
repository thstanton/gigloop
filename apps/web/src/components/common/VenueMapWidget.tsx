import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Car, KeyRound, MapPin, RefreshCw, Speaker } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { IconButton } from '@/components/common/IconButton';
import { SubLabel } from '@/components/common/SubLabel';

export interface VenueMapWidgetProps {
  venue: {
    name: string;
    email: string | null;
    phone: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    postcode: string | null;
    latitude: number | null;
    longitude: number | null;
    parkingInfo: string | null;
    accessInfo: string | null;
    equipmentAvailable: string | null;
  };
  /** Show venue name + contact details header. Hide on contact page where these are shown elsewhere. */
  showHeader?: boolean;
  /** Card title (e.g. "Venue") — shown in the Card header above the content. */
  cardTitle?: string;
  /** Card action rendered alongside the card title (e.g. an Edit button). */
  cardAction?: React.ReactNode;
  travelTime?: { minutes: number; distanceMetres: number } | null;
  isLoadingTravelTime?: boolean;
  onRefreshTravelTime?: () => void;
  contactHref?: string;
}

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
const MAPS_MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string;
const SCRIPT_ID = 'google-maps-script';
const CALLBACK = '__gmapsReady';

let mapsPromise: Promise<void> | null = null;

function loadMaps(): Promise<void> {
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise<void>((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    const importMaps = () =>
      win.google.maps.importLibrary('maps').then(resolve).catch(reject);
    if (win.google?.maps?.importLibrary) { importMaps(); return; }
    if (document.getElementById(SCRIPT_ID)) {
      const prev = win[CALLBACK];
      win[CALLBACK] = () => { prev?.(); importMaps(); };
      return;
    }
    win[CALLBACK] = importMaps;
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&loading=async&callback=${CALLBACK}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => { mapsPromise = null; reject(new Error('Maps failed')); };
    document.head.appendChild(script);
  });
  return mapsPromise;
}

export function VenueMapWidget({
  venue,
  showHeader = true,
  cardTitle,
  cardAction,
  travelTime,
  isLoadingTravelTime = false,
  onRefreshTravelTime,
  contactHref,
}: VenueMapWidgetProps) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const hasCoords = venue.latitude !== null && venue.longitude !== null;

  const formattedAddress = [venue.addressLine1, venue.addressLine2, venue.city, venue.postcode]
    .filter(Boolean)
    .join(', ');

  const mapsSearchUrl = formattedAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formattedAddress)}`
    : null;

  const distanceKm = travelTime ? (travelTime.distanceMetres / 1000).toFixed(1) : null;

  const hasVenueDetails = !!(venue.parkingInfo || venue.accessInfo || venue.equipmentAvailable);

  useEffect(() => {
    if (!hasCoords || !mapDivRef.current) return;
    const mapDiv = mapDivRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let marker: any;

    loadMaps()
      .then(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win = window as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { AdvancedMarkerElement } = await win.google.maps.importLibrary('marker') as any;
        const map = new win.google.maps.Map(mapDiv, {
          center: { lat: venue.latitude, lng: venue.longitude },
          zoom: 14,
          mapId: MAPS_MAP_ID,
          disableDefaultUI: true,
          gestureHandling: 'cooperative',
        });
        marker = new AdvancedMarkerElement({
          position: { lat: venue.latitude, lng: venue.longitude },
          map,
        });
      })
      .catch(() => setMapFailed(true));

    return () => {
      if (marker) marker.map = null;
    };
  }, [hasCoords, venue.latitude, venue.longitude]);

  let travelTimeStatus: ReactNode;
  if (isLoadingTravelTime) {
    travelTimeStatus = <RefreshCw size={14} className="animate-spin text-muted-foreground" />;
  } else if (travelTime) {
    travelTimeStatus = <span className="text-sm text-foreground">~{travelTime.minutes} min · {distanceKm} km driving</span>;
  } else {
    travelTimeStatus = <span className="text-sm text-muted-foreground">Travel time unavailable</span>;
  }

  let mapContent: ReactNode;
  if (!hasCoords) {
    mapContent = (
      <EmptyState
        icon={<MapPin size={24} />}
        heading="No map yet"
        description="Add a full address to see the venue on a map."
        className="h-full py-4"
      />
    );
  } else if (mapFailed) {
    mapContent = (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground p-4 text-center">
        Map unavailable
      </div>
    );
  } else {
    mapContent = <div ref={mapDivRef} className="h-full w-full" />;
  }

  return (
    <Card title={cardTitle} action={cardAction}>
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 space-y-4 min-w-0">

          {showHeader && (
            <div>
              {contactHref ? (
                <Link to={contactHref} className="font-medium hover:underline">
                  {venue.name}
                </Link>
              ) : (
                <span className="font-medium">{venue.name}</span>
              )}
              {(venue.email || venue.phone) && (
                <p className="text-sm text-muted mt-0.5">
                  {venue.email && (
                    <a href={`mailto:${venue.email}`} className="hover:text-primary transition-colors">
                      {venue.email}
                    </a>
                  )}
                  {venue.email && venue.phone && ' · '}
                  {venue.phone && (
                    <a href={`tel:${venue.phone}`} className="hover:text-primary transition-colors">
                      {venue.phone}
                    </a>
                  )}
                </p>
              )}
            </div>
          )}

          {formattedAddress && (
            <div className="space-y-1">
              <SubLabel>Address</SubLabel>
              <a
                href={mapsSearchUrl ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-1.5 text-sm text-foreground hover:underline mt-1"
              >
                <MapPin size={14} className="text-muted-foreground flex-shrink-0 mt-0.5" />
                <span>{formattedAddress}</span>
              </a>
              {onRefreshTravelTime !== undefined && (
                <div className="flex items-center gap-2 pt-1">
                  {travelTimeStatus}
                  {!isLoadingTravelTime && (
                    <IconButton label="Refresh travel time" onClick={onRefreshTravelTime}>
                      <RefreshCw size={14} />
                    </IconButton>
                  )}
                </div>
              )}
            </div>
          )}

          {hasVenueDetails && (
            <div className="space-y-3">
              <SubLabel>Venue details</SubLabel>
              {venue.parkingInfo && (
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-medium text-foreground mb-0.5">
                    <Car size={14} />
                    Parking
                  </div>
                  <p className="text-sm text-foreground">{venue.parkingInfo}</p>
                </div>
              )}
              {venue.accessInfo && (
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-medium text-foreground mb-0.5">
                    <KeyRound size={14} />
                    Access
                  </div>
                  <p className="text-sm text-foreground">{venue.accessInfo}</p>
                </div>
              )}
              {venue.equipmentAvailable && (
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-medium text-foreground mb-0.5">
                    <Speaker size={14} />
                    Equipment
                  </div>
                  <p className="text-sm text-foreground">{venue.equipmentAvailable}</p>
                </div>
              )}
            </div>
          )}


        </div>

        <div className={`md:w-64 h-48 rounded-md overflow-hidden flex-shrink-0 ${hasCoords ? 'bg-muted' : 'bg-surface border border-border'}`}>
          {mapContent}
        </div>
      </div>
    </Card>
  );
}
