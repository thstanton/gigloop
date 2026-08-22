import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import ItineraryCard from './ItineraryCard';
import type { BookingBandMember, BookingLogisticsEntry, BookingPackageSummary, PerformanceSet } from '@/types/api';

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

const rosterMembers: BookingBandMember[] = [
  {
    id: 'm1',
    contactId: 'c1',
    contact: { id: 'c1', name: 'Dave Chambers', email: 'dave@example.com' },
    bandPortalToken: 'm1-token',
    status: 'CONFIRMED',
    isSelf: false,
    sessionFee: null,
    invitedAt: null,
    respondedAt: null,
  },
];

export const WithBandRoster: Story = {
  name: 'Band roster renders inline under the package header (#887)',
  args: {
    logistics: fullLogistics,
    sets: setsWithStartTimes,
    packages,
    bandLineups: [{ id: 'lu1', label: null, packageIds: ['pkg1'] }],
    bandChairs: [
      { id: 'ch1', role: 'Vocals', order: 1, lineupId: 'lu1', memberId: 'm1', callTime: '15:30' },
      { id: 'ch2', role: 'Sax', order: 2, lineupId: 'lu1', memberId: null, callTime: '15:30' },
    ],
    bandMembers: rosterMembers,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Gold')).toBeVisible();
    await expect(canvas.getByText('Vocals')).toBeVisible();
    await expect(canvas.getByText('Dave Chambers')).toBeVisible();
    await expect(canvas.getByText('Sax')).toBeVisible();
    await expect(canvas.getByText('Vacant')).toBeVisible();
    // Nothing in the roster is clickable — no button role for a chair or a member.
    await expect(canvas.queryByRole('button', { name: 'Dave Chambers' })).not.toBeInTheDocument();
  },
};

export const RosterOnAPackagelessBooking: Story = {
  name: 'A package-less booking still renders its chairs, under "Whole day" (#887)',
  args: {
    logistics: null,
    sets: [],
    packages: [],
    bandLineups: [{ id: 'lu1', label: null, packageIds: [] }],
    bandChairs: [{ id: 'ch1', role: 'MC', order: 1, lineupId: 'lu1', memberId: null, callTime: null }],
    bandMembers: [],
  },
  play: async ({ canvas }) => {
    // The roster bypasses the "No itinerary yet" empty state entirely.
    await expect(canvas.queryByText('No itinerary yet')).not.toBeInTheDocument();
    await expect(canvas.getByText('Whole day')).toBeVisible();
    await expect(canvas.getByText('MC')).toBeVisible();
    await expect(canvas.getByText('Vacant')).toBeVisible();
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
