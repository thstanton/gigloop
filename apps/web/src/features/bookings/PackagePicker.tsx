import { useState } from 'react';
import { Check, Eye, Music, Clock, Sparkles } from 'lucide-react';
import { PACKAGE_ICON_MAP, GENRE_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { PackageTemplate } from '@/types/api';

// PRD #511 Module B / ADR-0053 / #546 — the shared package-template picker core. One controlled
// presentational component used by two surfaces (the New Booking form and the Builder's Package
// Templates step), so they look and behave the same. It owns no mutation and no fetch: templates
// + the current selection come in, a toggle goes out. Each chip selects on one click and carries
// an on-demand preview (its sets, plus — when the music form is enabled — the genres and special
// requests it seeds). Event-type-matching templates lead; the rest collapse under "Other".
//
// Replaces the create form's bespoke FormatSelector. NOT to be confused with the apply-one
// `TemplatePicker` in ItineraryFields, which the Itinerary's in-canvas add still uses (see #550).

function PackageIcon({ icon, size = 14 }: { icon: string; size?: number }) {
  const Icon = PACKAGE_ICON_MAP[icon] ?? Music;
  return <Icon size={size} />;
}

function durationLabel(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

function totalDuration(t: PackageTemplate): number {
  return t.slots.reduce((sum, s) => sum + s.duration, 0);
}

// The preview body: what applying this template gives you. Sets always; the music-form
// contribution only when the song-request form feature is on (showMusic).
function TemplatePreview({ template, showMusic }: { template: PackageTemplate; showMusic: boolean }) {
  const genres = template.defaultGenreSelection;
  const moments = template.keyMoments;
  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="mb-1 font-medium text-foreground">
          Sets ({template.slots.length} · {durationLabel(totalDuration(template))})
        </p>
        <ul className="space-y-1">
          {template.slots.map((s) => (
            <li key={s.id} className="flex items-center justify-between text-muted">
              <span className="flex items-center gap-1.5">
                <Clock size={12} aria-hidden="true" />
                {s.label || 'Set'}
              </span>
              <span>{durationLabel(s.duration)}</span>
            </li>
          ))}
        </ul>
      </div>

      {showMusic && (genres.length > 0 || moments.length > 0) && (
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
      )}
    </div>
  );
}

interface PackagePickerProps {
  templates: PackageTemplate[];
  templatesLoading?: boolean;
  /** Booking event type — matching templates lead, others collapse under "Other packages". */
  eventType: string;
  /** Currently-selected (create) / staged (Builder) template ids. */
  selectedIds: string[];
  onToggle: (id: string) => void;
  /** Show the music-form contribution in previews (songRequestFormEnabled). */
  showMusic: boolean;
}

export function PackagePicker({
  templates,
  templatesLoading = false,
  eventType,
  selectedIds,
  onToggle,
  showMusic,
}: PackagePickerProps) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [otherOpen, setOtherOpen] = useState(false);

  // Provenance is severed (ADR-0046): all enabled templates are offered; those matching the
  // event type lead.
  const enabled = templates.filter((t) => t.enabled);
  const matching = enabled.filter((t) => t.category === eventType);
  const other = enabled.filter((t) => t.category !== eventType);

  function chip(t: PackageTemplate) {
    const on = selectedIds.includes(t.id);
    const open = previewId === t.id;
    return (
      <div key={t.id} className="space-y-1.5">
        <div className={cn('inline-flex items-center rounded-full border text-sm transition-colors', on ? 'border-primary bg-primary/10' : 'border-border')}>
          <button
            type="button"
            onClick={() => onToggle(t.id)}
            aria-pressed={on}
            className="inline-flex items-center gap-1.5 py-1.5 pl-3 pr-1.5 transition-colors hover:opacity-80"
          >
            <PackageIcon icon={t.icon} />
            {t.label}
            {on && <Check size={12} className="text-primary" aria-hidden="true" />}
          </button>
          <button
            type="button"
            aria-label={`${open ? 'Hide' : 'Preview'} ${t.label}`}
            aria-expanded={open}
            onClick={() => setPreviewId(open ? null : t.id)}
            className="border-l border-border px-2 py-1.5 text-muted transition-colors hover:text-foreground"
          >
            <Eye size={13} aria-hidden="true" />
          </button>
        </div>
        {open && (
          <div className="w-72 max-w-full rounded-lg border border-border bg-background p-3">
            <TemplatePreview template={t} showMusic={showMusic} />
          </div>
        )}
      </div>
    );
  }

  if (templatesLoading) return <p className="text-sm text-muted">Loading…</p>;
  if (enabled.length === 0) return <p className="text-sm text-muted">No package templates available.</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start gap-2">{(matching.length > 0 ? matching : other).map(chip)}</div>
      {matching.length > 0 && other.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setOtherOpen((o) => !o)}
            className="text-sm text-muted transition-colors hover:text-foreground"
          >
            {otherOpen ? '▾' : '▸'} Other packages ({other.length})
          </button>
          {otherOpen && <div className="mt-2 flex flex-wrap items-start gap-2">{other.map(chip)}</div>}
        </div>
      )}
    </div>
  );
}
