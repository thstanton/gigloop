import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import ItineraryCard from './ItineraryCard';
import type { BookingLogisticsEntry, BookingPackageSummary, PerformanceSet } from '@/types/api';

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
    id: 'bp1',
    order: 0,
    packageId: 'pkg1',
    package: { id: 'pkg1', label: 'Gold', icon: 'crown', keyMoments: [], defaultGenreSelection: [] },
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
