import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Bell, Mail, LayoutDashboard, ListChecks, CheckCircle2, Circle, WandSparkles } from 'lucide-react';
import { apiPatch } from '@/lib/api';
import {
  BOOKING_STATUS_LABELS,
  STATUS_DESCRIPTIONS,
  STATUS_ACCENT_BG,
  GOAL_SUMMARIES,
} from '@/lib/constants';
import { useMe } from '@/lib/hooks/useMe';
import { toast } from '@/lib/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/common/PageHeader';
import { stepNav } from '@/features/onboarding/steps';
import type { ChecklistDefaultItem, BookingStatus } from '@/types/api';

const PATH = '/onboarding/checklist';

// The five forward lifecycle stages, in order (COMPLETE is terminal — no goals are worked on
// during it, so its card is an endpoint).
type Stage = Extract<BookingStatus, 'ENQUIRY' | 'PROVISIONAL' | 'CONFIRMED' | 'READY' | 'COMPLETE'>;
const STAGES: Stage[] = ['ENQUIRY', 'PROVISIONAL', 'CONFIRMED', 'READY', 'COMPLETE'];

// A goal is worked on — and reminded about — during the stage BEFORE its requiredForStatus
// (e.g. "Get the contract signed" is required FOR Confirmed, so it's chased while still
// Provisional). Grouping by this places each reminder in the stage it actually fires in.
const REMINDED_AT: Record<'PROVISIONAL' | 'CONFIRMED' | 'READY' | 'COMPLETE', Stage> = {
  PROVISIONAL: 'ENQUIRY',
  CONFIRMED: 'PROVISIONAL',
  READY: 'CONFIRMED',
  COMPLETE: 'READY',
};

function remindedAtStage(item: ChecklistDefaultItem): Stage | null {
  return item.requiredForStatus ? REMINDED_AT[item.requiredForStatus] : null;
}

// A representative snapshot of a live booking checklist, recreating GoalRow's visual language
// (status glyph → label → due chip → indented wand-led active step) so the musician can see where
// these reminders land. Static and illustrative — not the user's real data.
function MiniRing({ frac = 0.4, size = 14 }: { frac?: number; size?: number }) {
  const stroke = 2;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 shrink-0" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke="currentColor" className="text-border" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" stroke="currentColor"
        className="text-status-confirmed" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} />
    </svg>
  );
}

function MockGoal({ variant, label, step, due }: { variant: 'done' | 'active' | 'pending'; label: string; step?: string; due?: string }) {
  return (
    <div className={cn(variant === 'done' && 'opacity-60')}>
      <div className="flex items-center gap-2">
        {variant === 'done' && <CheckCircle2 size={14} className="shrink-0 text-status-confirmed" />}
        {variant === 'active' && <MiniRing />}
        {variant === 'pending' && <Circle size={14} className="shrink-0 text-border" />}
        <span className={cn('min-w-0 flex-1 truncate font-medium', variant === 'done' ? 'text-muted' : 'text-foreground')}>{label}</span>
        {due && <span className="shrink-0 text-[10px] text-amber-600">{due}</span>}
      </div>
      {step && (
        <div className="ml-[22px] mt-0.5 flex items-center gap-1 text-primary">
          <WandSparkles size={11} className="shrink-0" />
          <span className="truncate">{step}</span>
        </div>
      )}
    </div>
  );
}

function ChecklistPreview() {
  return (
    <div className="rounded-lg border border-border bg-background shadow-sm overflow-hidden sm:w-60 shrink-0">
      <div className="px-3 py-2 border-b border-border bg-muted/20 flex items-center justify-between">
        <span className="text-xs font-medium text-foreground truncate">The Oak Barn · Sat 14 Jun</span>
        <span className="text-[10px] text-muted tabular-nums">2/5</span>
      </div>
      <div className="p-3 flex flex-col gap-2.5 text-xs">
        <MockGoal variant="done" label="Get the quote accepted" />
        <MockGoal variant="done" label="Get the contract signed" />
        <MockGoal variant="active" label="Get the deposit paid" step="Send deposit invoice" due="Due in 5 days" />
        <MockGoal variant="pending" label="Get the balance paid" />
        <MockGoal variant="pending" label="Gather song requests" />
      </div>
    </div>
  );
}

// Orients the musician to the reminder feature and its surfaces. The digest is the one toggleable
// surface here (checklist + dashboard Actions are always on); its Switch reflects and updates
// digestEmailEnabled (lifted to the page so it saves on Next).
function ReminderCallout({ digestOn, onDigestChange }: { digestOn: boolean; onDigestChange: (v: boolean) => void }) {
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-col sm:flex-row gap-4">
      <div className="flex flex-col gap-3 flex-1 min-w-0">
        <div className="flex items-center gap-2 text-foreground">
          <Bell size={18} className="text-primary" />
          <h2 className="text-base font-semibold">GigLoop keeps every booking on track</h2>
        </div>
        <p className="text-sm text-foreground/70">As each task falls due, GigLoop makes sure you see it:</p>
        <div className="flex flex-col gap-2.5">
          <div className="flex items-start gap-2">
            <span className="flex h-5 items-center shrink-0"><ListChecks size={16} className="text-primary" /></span>
            <span className="text-sm text-foreground">On each booking's own <span className="font-medium">checklist</span> — your single to-do list for the gig.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="flex h-5 items-center shrink-0"><LayoutDashboard size={16} className="text-primary" /></span>
            <span className="text-sm text-foreground">In the <span className="font-medium">Actions</span> list on your dashboard.</span>
          </div>
          <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-primary/15">
            <span className="flex items-start gap-2">
              <span className="flex h-5 items-center shrink-0"><Mail size={16} className="text-primary" /></span>
              <span className="text-sm text-foreground">A weekly <span className="font-medium">Monday digest</span> email of what's due.</span>
            </span>
            <Switch checked={digestOn} onCheckedChange={onDigestChange} aria-label="Weekly digest email" />
          </div>
        </div>
      </div>
      <ChecklistPreview />
    </div>
  );
}

export default function OnboardingChecklistPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { prev, next } = stepNav(PATH);

  const { data: profile, isLoading } = useMe();

  const defaults = (profile?.preferences?.checklistDefaults ?? []) as ChecklistDefaultItem[];
  const initialDigest = profile?.digestEmailEnabled ?? true;

  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());
  const [digestOn, setDigestOn] = useState(initialDigest);

  useEffect(() => {
    if (defaults.length > 0) {
      setOverrides(new Map(defaults.map((d) => [d.key ?? d.label, d.enabled !== false])));
    }
  }, [defaults.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setDigestOn(initialDigest);
  }, [initialDigest]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: async () => {
      const systemOverrides = defaults
        .filter((d) => d.key)
        .filter((d) => (overrides.get(d.key!) ?? true) !== (d.enabled !== false))
        .map((d) => ({ key: d.key!, enabled: overrides.get(d.key!) ?? true }));
      if (systemOverrides.length > 0) {
        await apiPatch('/me/preferences/checklist-defaults', { systemItemOverrides: systemOverrides });
      }
      if (digestOn !== initialDigest) {
        await apiPatch('/me', { digestEmailEnabled: digestOn });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      if (next) navigate(next);
    },
    onError: () => {
      toast({ title: 'Failed to save. Please try again.', variant: 'destructive' });
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="How GigLoop runs your bookings"
        subheading="A booking moves through five stages. GigLoop tracks the right tasks at each one."
        className="mb-0"
      />

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-border/40 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <ReminderCallout digestOn={digestOn} onDigestChange={setDigestOn} />

          <p className="text-sm text-muted">
            Every booking gets this checklist — GigLoop builds it for you. Switch off any reminders you don't
            need, and add your own, or fine-tune these, anytime in Settings.
          </p>

          <div className="flex flex-col gap-4">
            {STAGES.map((stage) => {
              const goals = defaults.filter((d) => remindedAtStage(d) === stage);
              return (
                <div key={stage} className="rounded-xl border border-border overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-border bg-muted/30">
                    <p className="text-sm text-foreground/70">
                      <span className="inline-flex items-center gap-2 align-baseline mr-1">
                        <span className={cn('w-[3px] h-3 rounded-full', STATUS_ACCENT_BG[stage])} aria-hidden />
                        <span className="font-semibold text-foreground">{BOOKING_STATUS_LABELS[stage]} ·</span>
                      </span>
                      {STATUS_DESCRIPTIONS[stage]}
                    </p>
                  </div>
                  {goals.length ? (
                    <div className="divide-y divide-border">
                      {goals.map((g) => {
                        const key = g.key ?? g.label;
                        const checked = overrides.get(key) ?? true;
                        const summary = g.key ? GOAL_SUMMARIES[g.key] : undefined;
                        return (
                          <div key={key} className="flex items-start justify-between gap-3 px-4 py-3">
                            <div>
                              <p className="text-base text-foreground">{g.label}</p>
                              {summary && <p className="text-sm text-muted mt-0.5">{summary}</p>}
                            </div>
                            <Switch
                              checked={checked}
                              onCheckedChange={(val) => setOverrides((prevMap) => new Map(prevMap).set(key, val))}
                              aria-label={`${g.label}: ${checked ? 'enabled' : 'disabled'}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="px-4 py-3 text-sm text-muted">Nothing to track here — the booking's done.</p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="flex flex-col sm:flex-row items-start gap-3 pt-2">
        {prev && (
          <Button variant="outline" onClick={() => navigate(prev)}>
            Back
          </Button>
        )}
        <Button onClick={() => save()} disabled={isPending}>
          {isPending ? 'Saving…' : 'Next'}
        </Button>
        {next && (
          <Button variant="ghost" onClick={() => navigate(next)} disabled={isPending}>
            Skip for now — customise in Settings
          </Button>
        )}
      </div>
    </div>
  );
}
