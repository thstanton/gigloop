import { Sparkles } from 'lucide-react';
import { GENRE_LABELS } from '@/lib/constants';

// #552 — the "what this template seeds into the music form" box, shared by the two surfaces that
// show a package template's whole shape: the booking PackagePicker preview and the admin
// PackageCard on /admin/packages. Genres render as request-palette pills; special requests as a
// bulleted list. Renders nothing when the template seeds neither (so callers can drop it in
// unconditionally). Markup is the original PackagePicker preview block, kept identical.

export function PackageMusicSummary({ genres, moments }: { genres: string[]; moments: string[] }) {
  if (genres.length === 0 && moments.length === 0) return null;
  return (
    <div className="space-y-2 rounded border border-border bg-primary/5 p-2.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <Sparkles size={12} aria-hidden="true" />Sets up the music form with:
      </p>
      {genres.length > 0 && (
        <div>
          <p className="text-xs text-muted">Genres the client can request songs from</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {genres.map((g) => (
              <span key={g} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-foreground">
                {GENRE_LABELS[g as keyof typeof GENRE_LABELS] ?? g}
              </span>
            ))}
          </div>
        </div>
      )}
      {moments.length > 0 && (
        <div>
          <p className="text-xs text-muted">Special-request moments the client can fill in</p>
          <ul className="mt-1 list-inside list-disc text-xs text-foreground">
            {moments.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
