import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, Download, CheckCircle, Clock } from 'lucide-react';
import { getPortalData } from '../../lib/portalApi';
import { PortalLayout } from '../../layouts/PortalLayout';
import type { PortalData } from '../../types/api';

function BookingSummary({ data }: { data: PortalData }) {
  const { booking, publicProfile } = data;
  const brand = publicProfile.brandColour ?? '#1a1a1a';
  const isBold = publicProfile.portalTheme === 'BOLD_MODERN' || publicProfile.portalTheme === 'BOLD_ROMANTIC';

  const date = new Date(booking.date);
  const formattedDate = date.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-6">
      <div>
        <p className={`text-sm mb-1 ${isBold ? 'text-white/60' : 'text-[#6b7280]'}`}>
          Hi {booking.customerName},
        </p>
        <h1 className={`text-2xl font-semibold ${isBold ? 'text-white' : 'text-[#1a1a1a]'}`}>
          {booking.title ?? `Your booking with ${publicProfile.displayName ?? publicProfile.businessName}`}
        </h1>
      </div>

      <div className={`rounded-lg p-5 space-y-3 ${isBold ? 'bg-white/10' : 'bg-[#f9fafb] border border-[#e5e5e5]'}`}>
        <div className="flex justify-between text-sm">
          <span className={isBold ? 'text-white/60' : 'text-[#6b7280]'}>Date</span>
          <span className={`font-medium ${isBold ? 'text-white' : 'text-[#1a1a1a]'}`}>{formattedDate}</span>
        </div>
        {booking.venueName && (
          <div className="flex justify-between text-sm">
            <span className={isBold ? 'text-white/60' : 'text-[#6b7280]'}>Venue</span>
            <span className={`font-medium ${isBold ? 'text-white' : 'text-[#1a1a1a]'}`}>{booking.venueName}</span>
          </div>
        )}
        {booking.fee != null && (
          <div className="flex justify-between text-sm">
            <span className={isBold ? 'text-white/60' : 'text-[#6b7280]'}>Fee</span>
            <span className={`font-medium ${isBold ? 'text-white' : 'text-[#1a1a1a]'}`}>£{booking.fee}</span>
          </div>
        )}
        {booking.sets.length > 0 && (
          <div className="flex justify-between text-sm">
            <span className={isBold ? 'text-white/60' : 'text-[#6b7280]'}>Sets</span>
            <div className="text-right">
              {booking.sets.map((s) => (
                <div key={s.order} className={`font-medium ${isBold ? 'text-white' : 'text-[#1a1a1a]'}`}>
                  {s.label ?? `Set ${s.order + 1}`}
                  {s.startTime && ` · ${s.startTime}`}
                  {s.duration && ` (${s.duration} min)`}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {data.depositInvoiceDueDate && !booking.contractSignedAt && (
        <div className={`flex items-start gap-3 rounded-lg p-4 text-sm ${isBold ? 'bg-white/10' : 'bg-amber-50 border border-amber-200'}`}>
          <Clock className={`mt-0.5 h-4 w-4 flex-shrink-0 ${isBold ? 'text-white/60' : 'text-amber-600'}`} />
          <span className={isBold ? 'text-white/80' : 'text-amber-800'}>
            Deposit due by {new Date(data.depositInvoiceDueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
      )}

      <div className="space-y-3">
        {booking.contractSignedAt ? (
          <div className={`flex items-center gap-3 rounded-lg p-4 text-sm ${isBold ? 'bg-white/10' : 'bg-green-50 border border-green-200'}`}>
            <CheckCircle className={`h-4 w-4 flex-shrink-0 ${isBold ? 'text-green-400' : 'text-green-600'}`} />
            <span className={isBold ? 'text-white/80' : 'text-green-800'}>
              Contract signed {new Date(booking.contractSignedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        ) : (
          <Link
            to="contract"
            className="flex items-center justify-center gap-2 w-full rounded-lg px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: brand }}
          >
            <FileText className="h-4 w-4" />
            Review &amp; sign contract
          </Link>
        )}

        {data.signedContractUrl && (
          <a
            href={data.signedContractUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center justify-center gap-2 w-full rounded-lg px-5 py-3 text-sm font-medium border transition-opacity hover:opacity-80 ${
              isBold ? 'border-white/20 text-white' : 'border-[#e5e5e5] text-[#1a1a1a]'
            }`}
          >
            <Download className="h-4 w-4" />
            Download signed contract
          </a>
        )}
      </div>
    </div>
  );
}

export default function PortalPage() {
  const { token } = useParams<{ token: string }>();

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

  return (
    <PortalLayout profile={data.publicProfile}>
      <BookingSummary data={data} />
    </PortalLayout>
  );
}
