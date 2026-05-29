import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export function PreviewBanner({ customerName, backHref }: { customerName: string; backHref: string }) {
  return (
    <div className="sticky top-0 z-50 bg-[#1a1a1a] h-10 flex items-center gap-4 px-4 shrink-0">
      <Link
        to={backHref}
        className="inline-flex items-center gap-1 text-white/50 hover:text-white transition-colors text-xs flex-shrink-0"
      >
        <ChevronLeft size={13} />
        Back to booking
      </Link>
      <span className="text-white/50 text-xs">·</span>
      <span className="text-white/65 text-xs">
        Preview — this is what{' '}
        <span className="text-white font-medium">{customerName}</span> sees
      </span>
    </div>
  );
}
