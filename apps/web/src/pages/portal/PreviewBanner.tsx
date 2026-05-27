import { Link } from 'react-router-dom';

export function PreviewBanner({ customerName, backHref }: { customerName: string; backHref: string }) {
  return (
    <div className="sticky top-0 z-50 bg-[#1a1a1a] h-10 flex items-center justify-between gap-4 px-4 shrink-0">
      <span className="text-white/65 text-xs">
        Preview — this is what{' '}
        <span className="text-white font-medium">{customerName}</span> sees
      </span>
      <Link to={backHref} className="text-white/50 hover:text-white transition-colors text-xs">
        ← Back to booking
      </Link>
    </div>
  );
}
