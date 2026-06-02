import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, RefreshCw } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { IconButton } from '@/components/common/IconButton';
import { SubLabel } from '@/components/common/SubLabel';

export interface VenueMapWidgetProps {
  venue: {
    name: string;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    postcode: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  travelTime?: { minutes: number; distanceMetres: number } | null;
  isLoadingTravelTime?: boolean;
  onRefreshTravelTime?: () => void;
  contactHref?: string;
}

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
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

  useEffect(() => {
    if (!hasCoords || !mapDivRef.current) return;
    const mapDiv = mapDivRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let marker: any;

    loadMaps()
      .then(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const win = window as any;
        const map = new win.google.maps.Map(mapDiv, {
          center: { lat: venue.latitude, lng: venue.longitude },
          zoom: 14,
          disableDefaultUI: true,
          gestureHandling: 'cooperative',
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        marker = new (win.google.maps.Marker as any)({
          position: { lat: venue.latitude, lng: venue.longitude },
          map,
        });
      })
      .catch(() => setMapFailed(true));

    return () => {
      marker?.setMap(null);
    };
  }, [hasCoords, venue.latitude, venue.longitude]);

  return (
    <Card>
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 space-y-3 min-w-0">
          <div>
            {contactHref ? (
              <Link to={contactHref} className="font-medium hover:underline">
                {venue.name}
              </Link>
            ) : (
              <span className="font-medium">{venue.name}</span>
            )}
          </div>

          {formattedAddress ? (
            <div>
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
            </div>
          ) : null}

          {onRefreshTravelTime !== undefined && (
            <div className="flex items-center gap-2">
              {isLoadingTravelTime ? (
                <RefreshCw size={14} className="animate-spin text-muted-foreground" />
              ) : travelTime ? (
                <span className="text-sm text-foreground">
                  ~{travelTime.minutes} min · {distanceKm} km driving
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">Travel time unavailable</span>
              )}
              {!isLoadingTravelTime && (
                <IconButton label="Refresh travel time" onClick={onRefreshTravelTime}>
                  <RefreshCw size={14} />
                </IconButton>
              )}
            </div>
          )}
        </div>

        <div className="md:w-64 h-48 rounded-md overflow-hidden bg-muted flex-shrink-0">
          {hasCoords ? (
            mapFailed ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground p-4 text-center">
                Map unavailable
              </div>
            ) : (
              <div ref={mapDivRef} className="h-full w-full" />
            )
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground p-4 text-center">
              No address on file — add one to see the map.
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
