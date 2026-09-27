import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { ApiError, getBandPortalData } from '../../lib/portalApi';
import { BandGigSheet } from '../../features/portal/BandGigSheet';

// The dep-facing container for `/band/:token` (#891, ADR-0073) — fetch + loading/error states only;
// every rendering decision lives in `BandGigSheet`, the presentational body (ADR-0023's
// build-the-presentational-layer-first sequence). Matches `PortalPage.tsx`'s own container shape,
// including reading `ApiError` (not a bare `Response`) so a 404 renders "Link not found" rather
// than falling through to the generic failure state.
//
// Deliberately NOT gated on VITE_FEATURE_BAND_MEMBERS itself, unlike every other band-facing
// surface in apps/web: those are reached via in-app navigation a flag can hide, but a portal link
// is a bearer token opened directly by a dep, never navigated to from inside GigLoop. The API's own
// FEATURE_BAND_MEMBERS gate (band-portal.controller.ts) is the sole authority — with the flag off it
// 404s exactly as an unknown token does, which this page already renders as "Link not found" below.
export default function BandPortalPage() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['band-portal', token],
    queryFn: () => getBandPortalData(token!),
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
    const status = error instanceof ApiError ? error.status : 0;
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="text-center max-w-sm">
          <FileText className="mx-auto mb-4 h-10 w-10 text-[#9ca3af]" />
          <h1 className="text-lg font-semibold text-[#1a1a1a] mb-2">
            {status === 404 ? 'Link not found' : 'Something went wrong'}
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

  return <BandGigSheet data={data} />;
}
