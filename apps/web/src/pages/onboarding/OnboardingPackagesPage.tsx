import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Check, Boxes, Music, Sparkles } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { TogglePill } from '@/components/ui/toggle-pill';
import { PageHeader } from '@/components/common/PageHeader';
import { PageSection } from '@/components/common/PageSection';
import { SubLabel } from '@/components/common/SubLabel';
import {
  GENRE_LABELS,
  PACKAGE_ICON_MAP,
  PACKAGE_CATEGORY_LABELS,
  PACKAGE_CATEGORY_ORDER,
} from '@/lib/constants';
import {
  PackageForm,
  catalogueToFormValues,
  packageFormToPayload,
  type PackageFormValues,
  type PackageFormHints,
} from '@/features/packages/PackageForm';
import { stepNav } from '@/features/onboarding/steps';
import type { PackageCatalogueItem, PackageTemplate } from '@/types/api';

const PATH = '/onboarding/packages';

const FORM_HINTS: PackageFormHints = {
  label: 'The name your client sees on the quote.',
  category: 'Groups this template with similar booking types.',
  notes: 'Private notes for you — never shown to the client.',
  keyMoments: 'Moments the client can request a song for — first dance, cake cutting…',
  defaultGenreSelection: 'Genres the client can choose songs from on their song form.',
};

// A compact, static template card for the callout — illustrates what a package template is: its sets
// plus a minimal "Sets up the music form with" section.
function MockTemplateCard({ item }: { item: PackageCatalogueItem }) {
  const Icon = PACKAGE_ICON_MAP[item.icon] ?? Music;
  const exampleMoment = item.keyMoments[0];
  return (
    <div className="w-full overflow-hidden rounded-lg border border-border bg-background shadow-sm sm:w-60 sm:shrink-0">
      <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-3 py-2">
        <Icon size={16} className="shrink-0 text-primary" />
        <span className="truncate text-xs font-medium text-foreground">{item.label}</span>
      </div>
      <div className="flex flex-col gap-2.5 p-3 text-xs">
        <div className="flex flex-col gap-1">
          {item.slots.slice(0, 3).map((s, i) => (
            <div key={i} className="flex justify-between gap-2">
              <span className="truncate text-foreground">{s.label ?? 'Set'}</span>
              <span className="shrink-0 text-muted tabular-nums">{s.duration}m</span>
            </div>
          ))}
        </div>
        {(item.defaultGenreSelection.length > 0 || exampleMoment) && (
          <div className="space-y-1.5 rounded border border-border bg-primary/5 p-2">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <Sparkles size={11} aria-hidden /> Sets up the music form with
            </p>
            {item.defaultGenreSelection.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.defaultGenreSelection.slice(0, 2).map((g) => (
                  <span key={g} className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-foreground">
                    {GENRE_LABELS[g as keyof typeof GENRE_LABELS] ?? g}
                  </span>
                ))}
              </div>
            )}
            {exampleMoment && (
              <p className="text-[11px] text-muted">
                Special request: <span className="text-foreground">{exampleMoment}</span>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Groups the catalogue starters by category, in the canonical category order (uncategorised last).
function groupByCategory(items: PackageCatalogueItem[]): { label: string; items: PackageCatalogueItem[] }[] {
  const groups: { label: string; items: PackageCatalogueItem[] }[] = [];
  for (const cat of PACKAGE_CATEGORY_ORDER) {
    const inCat = items.filter((i) => i.category === cat);
    if (inCat.length) groups.push({ label: PACKAGE_CATEGORY_LABELS[cat] ?? cat, items: inCat });
  }
  const uncategorised = items.filter((i) => !i.category);
  if (uncategorised.length) groups.push({ label: 'Other', items: uncategorised });
  return groups;
}

// The starter chips, grouped by category — picking one seeds the inline editor.
function StarterChips({
  groups,
  selectedId,
  onPick,
}: {
  groups: { label: string; items: PackageCatalogueItem[] }[];
  selectedId: string | null;
  onPick: (item: PackageCatalogueItem) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-1.5">
          <SubLabel>{group.label}</SubLabel>
          <div className="flex flex-wrap gap-2">
            {group.items.map((item) => {
              const active = selectedId === item.id;
              return (
                <TogglePill key={item.id} active={active} onClick={() => onPick(item)} className="px-4 py-2">
                  {active && <Check size={14} />}
                  {item.label}
                </TogglePill>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function OnboardingPackagesPage() {
  const navigate = useNavigate();
  const { isLoaded } = useAuth();
  const queryClient = useQueryClient();
  const { prev, next } = stepNav(PATH);

  const { data: catalogue = [], isLoading } = useQuery({
    queryKey: ['packageCatalogue'],
    queryFn: () => apiGet<PackageCatalogueItem[]>('/packages/catalogue'),
    enabled: isLoaded,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<PackageFormValues | null>(null);

  function pickStarter(item: PackageCatalogueItem) {
    setSelectedId(item.id);
    setForm(catalogueToFormValues(item));
  }

  const { mutate: saveTemplate, isPending } = useMutation({
    mutationFn: () => apiPost<PackageTemplate>('/packages', packageFormToPayload(form!)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      if (next) navigate(next);
    },
    onError: () => toast({ title: 'Failed to save your template. Please try again.', variant: 'destructive' }),
  });

  // Recomputed only when the catalogue loads — the page re-renders per keystroke of the
  // inline editor, so this shouldn't re-group on every render.
  const groups = useMemo(() => groupByCategory(catalogue), [catalogue]);

  return (
    <div>
      <PageHeader
        title="What you offer"
        subheading="Set up bookings quickly and easily with reusable templates of your most popular types of booking."
        className="mb-0"
      />

      <div className="flex flex-col gap-6">
        {/* Callout — what a package template is */}
        <div className="flex flex-col gap-4 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex items-center gap-2 text-foreground">
              <Boxes size={18} className="text-primary" />
              <h2 className="text-base font-semibold">Package Templates</h2>
            </div>
            <div className="text-sm text-foreground/70">
              <p>Can include:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                <li>Sets</li>
                <li>Musical Genres</li>
                <li>
                  Special Requests{' '}
                  <span className="text-muted">
                    (key moments that the client might want to request a song for, such as a first dance)
                  </span>
                </li>
              </ul>
            </div>
            <p className="text-sm text-foreground/70">
              You can add any number of templates to a booking, and customise them for each booking.
            </p>
          </div>
          {catalogue[0] && <MockTemplateCard item={catalogue[0]} />}
        </div>

        {/* The question */}
        <div className="flex flex-col gap-3">
          <PageSection
            title="What's your most common type of booking?"
            description="We'll set up your first package template for it — shape it below to make it your own."
            className="mb-0"
          />
          {isLoading ? (
            <div className="h-10 w-full max-w-sm animate-pulse rounded bg-border/40" />
          ) : (
            <StarterChips groups={groups} selectedId={selectedId} onPick={pickStarter} />
          )}
        </div>

        {/* Revealed inline editor */}
        {form && (
          <div className="rounded-lg border border-border p-4 sm:p-6">
            <p className="mb-4 text-sm text-muted">
              Adjust the sets, moments and genres so this template is yours.
            </p>
            <PackageForm value={form} onChange={(patch) => setForm((v) => v && { ...v, ...patch })} hints={FORM_HINTS} />
          </div>
        )}

        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          {prev && (
            <Button variant="outline" onClick={() => navigate(prev)} disabled={isPending}>
              Back
            </Button>
          )}
          <Button onClick={() => saveTemplate()} disabled={!form || isPending}>
            {isPending ? 'Saving…' : 'Save & continue'}
          </Button>
          {next && (
            <Button variant="ghost" onClick={() => navigate(next)} disabled={isPending}>
              Skip for now — customise in Settings
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
