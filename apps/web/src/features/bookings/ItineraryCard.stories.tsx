import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import ItineraryCard from './ItineraryCard';
import type { BookingBandChair, BookingBandMember, BookingLineup, BookingLogisticsEntry, BookingPackageSummary, PerformanceSet } from '@/types/api';

const fullLogistics: Record<string, BookingLogisticsEntry> = {
  arrivalTime: { value: '14:00', shareWithBand: true, shareWithClient: false },
  soundCheckTime: { value: '15:00', shareWithBand: true, shareWithClient: false },
  finishTime: { value: '23:00', shareWithBand: true, shareWithClient: false },
};

const setsWithStartTimes: PerformanceSet[] = [
  { id: 's1', order: 0, duration: 45, startTime: '15:30', label: 'Ceremony', packageId: 'pkg1' },
  { id: 's2', order: 1, duration: 60, startTime: '18:00', label: 'Dinner', packageId: 'pkg1' },
  { id: 's3', order: 2, duration: 90, startTime: '20:00', label: 'Evening', packageId: 'pkg1' },
];

const setsWithDurationsOnly: PerformanceSet[] = [
  { id: 's1', order: 0, duration: 45, startTime: null, label: 'Ceremony', packageId: 'pkg1' },
  { id: 's2', order: 1, duration: 90, startTime: null, label: 'Evening', packageId: 'pkg1' },
];

const packages: BookingPackageSummary[] = [
  {
    id: 'pkg1',
    order: 0,
    label: 'Gold',
    icon: 'crown',
  },
];

const meta = {
  component: ItineraryCard,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
  parameters: { viewport: { defaultViewport: 'mobile1' } },
} satisfies Meta<typeof ItineraryCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullTimeline: Story = {
  args: {
    logistics: fullLogistics,
    sets: setsWithStartTimes,
    packages,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('14:00')).toBeVisible();
    await expect(canvas.getByText('15:00')).toBeVisible();
    await expect(canvas.getByText('23:00')).toBeVisible();
    await expect(canvas.getByText('Ceremony (45 min)')).toBeVisible();
    await expect(canvas.getByText('15:30')).toBeVisible();
    // The package name leads its run of sets as a header (ADR-0050 read view).
    await expect(canvas.getByText('Gold')).toBeVisible();
  },
};

export const TwoPackages: Story = {
  name: 'Each package run leads with its own name header',
  args: {
    logistics: fullLogistics,
    sets: [
      { id: 'c1', order: 0, duration: 30, startTime: '15:30', label: 'Ceremony', packageId: 'pkg-cer' },
      { id: 'e1', order: 1, duration: 45, startTime: '19:30', label: 'First set', packageId: 'pkg-eve' },
      { id: 'e2', order: 2, duration: 45, startTime: '21:00', label: 'Second set', packageId: 'pkg-eve' },
    ],
    packages: [
      { id: 'pkg-cer', order: 0, label: 'Ceremony package', icon: 'heart' },
      { id: 'pkg-eve', order: 1, label: 'Evening', icon: 'guitar' },
    ],
  },
  play: async ({ canvas }) => {
    // Both package names render as run headers; anchors still bookend the day.
    await expect(canvas.getByText('Ceremony package')).toBeVisible();
    await expect(canvas.getByText('Evening')).toBeVisible();
    await expect(canvas.getByText('Arrival')).toBeVisible();
    await expect(canvas.getByText('Finish')).toBeVisible();
    // The Evening header appears once even though it has two sets.
    await expect(canvas.getAllByText('Evening')).toHaveLength(1);
  },
};

export const PartialNoArrivalOrFinish: Story = {
  args: {
    logistics: {
      soundCheckTime: { value: '15:00', shareWithBand: true, shareWithClient: false },
    },
    sets: setsWithDurationsOnly,
    packages,
  },
};

export const SetsOnlyDurationFallback: Story = {
  args: {
    logistics: null,
    sets: setsWithDurationsOnly,
    packages,
  },
};

export const TimesOnly: Story = {
  args: {
    logistics: fullLogistics,
    sets: [],
    packages: [],
  },
};

export const Empty: Story = {
  args: {
    logistics: null,
    sets: [],
    packages: [],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('No itinerary yet')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Add itinerary' })).toBeVisible();
  },
};

// ─── #1056 — the day is the spine (ADR-0084 §1–2). One story per canvas state; the design
// contract in the issue is binding. Parts render UNDER each package header, before its sets.
const bandMember = (
  id: string,
  name: string,
  status: BookingBandMember['status'] = 'CONFIRMED',
  isSelf = false,
): BookingBandMember => ({
  id,
  contactId: `c-${id}`,
  contact: { id: `c-${id}`, name, email: `${id}@example.com` },
  bandPortalToken: `${id}-token`,
  status,
  isSelf,
  sessionFee: null,
  invitedAt: null,
  respondedAt: null,
});

const part = (id: string, lineupId: string, order: number, role: string, memberId: string | null): BookingBandChair => ({
  id,
  role,
  order,
  lineupId,
  memberId,
  callTimes: [],
});

const weddingPackages: BookingPackageSummary[] = [
  { id: 'pkg-cer', order: 0, label: 'Ceremony', icon: 'heart' },
  { id: 'pkg-drinks', order: 1, label: 'Drinks Reception', icon: 'martini' },
  { id: 'pkg-eve', order: 2, label: 'Evening Party', icon: 'guitar' },
];

const weddingSets: PerformanceSet[] = [
  { id: 'w1', order: 0, duration: 30, startTime: '14:00', label: null, packageId: 'pkg-cer' },
  { id: 'w2', order: 0, duration: 60, startTime: '16:00', label: null, packageId: 'pkg-drinks' },
  { id: 'w3', order: 0, duration: 90, startTime: '20:00', label: null, packageId: 'pkg-eve' },
];

const weddingMembers = [
  bandMember('me', 'Tim', 'CONFIRMED', true),
  bandMember('ana', 'Ana Ruiz'),
  bandMember('ben', 'Ben Okafor'),
  bandMember('cal', 'Cal Wright'),
  bandMember('dev', 'Dev Patel', 'INVITED'),
];

const weddingLineups: BookingLineup[] = [
  { id: 'lu-solo', label: null, packageIds: ['pkg-cer'] },
  { id: 'lu-trio', label: null, packageIds: ['pkg-drinks'] },
  { id: 'lu-five', label: null, packageIds: ['pkg-eve'] },
];

const weddingChairs: BookingBandChair[] = [
  part('s1', 'lu-solo', 1, 'Vocals', 'me'),
  part('t1', 'lu-trio', 1, 'Vocals', 'ana'),
  part('t2', 'lu-trio', 2, 'Keys', 'ben'),
  part('t3', 'lu-trio', 3, 'Bass', 'cal'),
  part('f1', 'lu-five', 1, 'Vocals', 'ana'),
  part('f2', 'lu-five', 2, 'Keys', 'ben'),
  part('f3', 'lu-five', 3, 'Bass', 'cal'),
  part('f4', 'lu-five', 4, 'Drums', 'dev'),
  part('f5', 'lu-five', 5, 'Sax', null),
];

export const FullGig: Story = {
  name: 'Artboard 1 — the wedding: a lineup per package, summarised under each header',
  args: {
    logistics: fullLogistics,
    sets: weddingSets,
    packages: weddingPackages,
    bandLineups: weddingLineups,
    bandChairs: weddingChairs,
    bandMembers: weddingMembers,
  },
  play: async ({ canvas }) => {
    // Header: bold package label, then muted "{lineup} · {summary}".
    await expect(canvas.getByText('Solo · you')).toBeVisible();
    await expect(canvas.getByText('Trio · all confirmed')).toBeVisible();
    // "still to fill" is the one emphasised summary, so it sits in its own span after the lineup.
    await expect(canvas.getByText('1 still to fill')).toBeVisible();
    await expect(canvas.getByText(/^5-piece ·$/)).toBeVisible();
    // Part rows: You / {name} / {name} · waiting / Needs a player.
    await expect(canvas.getByText('You')).toBeVisible();
    await expect(canvas.getAllByText('Ana Ruiz').length).toBeGreaterThan(0);
    await expect(canvas.getByText('Dev Patel · waiting')).toBeVisible();
    await expect(canvas.getByText('Needs a player')).toBeVisible();
    // Arrive, soundcheck and finish stay generic time rows, attributed to no package.
    await expect(canvas.getByText('Arrival')).toBeVisible();
    await expect(canvas.getByText('Finish')).toBeVisible();
    // Must not: the retired vocabulary, or call / first-playing times on this card.
    await expect(canvas.queryByText(/vacant/i)).not.toBeInTheDocument();
    await expect(canvas.queryByText(/\bband\b/i)).not.toBeInTheDocument();
    await expect(canvas.queryByText(/call time|first playing/i)).not.toBeInTheDocument();
  },
};

export const SharedLineup: Story = {
  name: 'One lineup plays two packages: the later one says "same as", its parts are not listed again',
  args: {
    logistics: fullLogistics,
    sets: weddingSets,
    packages: weddingPackages,
    bandLineups: [
      { id: 'lu-trio', label: null, packageIds: ['pkg-cer', 'pkg-drinks'] },
      { id: 'lu-five', label: null, packageIds: ['pkg-eve'] },
    ],
    bandChairs: weddingChairs.filter((c) => c.lineupId !== 'lu-solo'),
    bandMembers: weddingMembers,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Trio · all confirmed')).toBeVisible();
    await expect(canvas.getByText('Trio · same as Ceremony')).toBeVisible();
    // The trio's three parts render once (under Ceremony), not again under Drinks Reception.
    await expect(canvas.getAllByText('Bass')).toHaveLength(2); // trio once + five-piece once
  },
};

export const DecideLater: Story = {
  name: 'A package with no lineup ("Decide later") shows no lineup line',
  args: {
    logistics: fullLogistics,
    sets: weddingSets,
    packages: weddingPackages,
    bandLineups: [{ id: 'lu-five', label: null, packageIds: ['pkg-eve'] }],
    bandChairs: weddingChairs.filter((c) => c.lineupId === 'lu-five'),
    bandMembers: weddingMembers,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Ceremony')).toBeVisible();
    await expect(canvas.getByText('Drinks Reception')).toBeVisible();
    await expect(canvas.getByText('1 still to fill')).toBeVisible();
    // Only the evening carries a lineup line: no other header has a "{lineup} · {summary}".
    await expect(canvas.queryByText(/^(Solo|Duo|Trio) ·/)).not.toBeInTheDocument();
    await expect(canvas.getAllByText(/^5-piece ·/)).toHaveLength(1);
  },
};

export const PackagelessGig: Story = {
  name: 'A booking with no packages lists its lineup\'s parts once, above the sets',
  args: {
    logistics: fullLogistics,
    sets: [{ id: 'p1', order: 0, duration: 45, startTime: '20:00', label: 'Set one', packageId: null }],
    packages: [],
    bandLineups: [{ id: 'lu1', label: null, packageIds: [] }],
    bandChairs: [part('c1', 'lu1', 1, 'MC', null), part('c2', 'lu1', 2, 'Guitar', 'ana')],
    bandMembers: [bandMember('ana', 'Ana Ruiz')],
  },
  play: async ({ canvas }) => {
    // The parts bypass the "No itinerary yet" empty state, and no whole-gig heading is invented.
    await expect(canvas.queryByText('No itinerary yet')).not.toBeInTheDocument();
    await expect(canvas.getByText('Needs a player')).toBeVisible();
    await expect(canvas.getByText('Ana Ruiz')).toBeVisible();
    await expect(canvas.queryByText(/vacant/i)).not.toBeInTheDocument();
  },
};

export const NoBand: Story = {
  name: 'Band flag on, no lineups yet: the itinerary alone, unchanged',
  args: {
    logistics: fullLogistics,
    sets: weddingSets,
    packages: weddingPackages,
    bandLineups: [],
    bandChairs: [],
    bandMembers: weddingMembers,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Ceremony')).toBeVisible();
    await expect(canvas.queryByText(/still to fill|all confirmed|Needs a player/)).not.toBeInTheDocument();
  },
};

export const WithTimeNotes: Story = {
  args: {
    logistics: {
      arrivalTime: { value: '18:45', notes: 'Gate closes at 9', shareWithBand: true, shareWithClient: false },
      soundCheckTime: { value: '19:30', shareWithBand: true, shareWithClient: false },
      finishTime: { value: '23:00', notes: 'Hard finish — venue curfew', shareWithBand: true, shareWithClient: false },
    },
    sets: setsWithStartTimes,
    packages,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Gate closes at 9')).toBeVisible();
    await expect(canvas.getByText('Hard finish — venue curfew')).toBeVisible();
  },
};
