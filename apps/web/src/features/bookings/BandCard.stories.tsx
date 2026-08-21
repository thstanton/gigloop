import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import BandCard from './BandCard';
import { bandMember } from '@/test/factories';
import type { BookingBand, BookingBandChair, BookingPackageSummary } from '@/types/api';

// Band members v1 (#879, ADR-0072 §6, #887): the Info tab's directory, grouped by answer rather
// than a flat list. Confirmed · Waiting on · Still to sort · Chairs to fill, empty groups omitted.

const packages: BookingPackageSummary[] = [{ id: 'pkg-evening', order: 0, label: 'Evening', icon: 'guitar' }];

const chairs: BookingBandChair[] = [
  { id: 'ch1', role: 'Vocals', order: 0, packageId: 'pkg-evening', memberId: 'm-confirmed', callTime: '19:30' },
  { id: 'ch2', role: 'Sax', order: 1, packageId: 'pkg-evening', memberId: 'm-confirmed', callTime: '19:30' },
  { id: 'ch3', role: 'Guitar', order: 2, packageId: 'pkg-evening', memberId: 'm-invited', callTime: '19:30' },
  { id: 'ch4', role: 'Drums', order: 3, packageId: 'pkg-evening', memberId: 'm-added', callTime: '19:30' },
  { id: 'ch5', role: 'Keys', order: 4, packageId: null, memberId: null, callTime: null },
  { id: 'ch6', role: 'Cello', order: 5, packageId: 'pkg-evening', memberId: 'm-declined', callTime: '19:30' },
];

const band: BookingBand = {
  chairs,
  members: [
    bandMember({
      id: 'm-confirmed',
      contactId: 'c1',
      contact: { id: 'c1', name: 'Dave Chambers', email: 'dave@example.com' },
      status: 'CONFIRMED',
    }),
    bandMember({
      id: 'm-invited',
      contactId: 'c2',
      contact: { id: 'c2', name: 'Priya Shah', email: 'priya@example.com' },
      status: 'INVITED',
    }),
    bandMember({
      id: 'm-added',
      contactId: 'c3',
      contact: { id: 'c3', name: 'Leo Novak', email: null },
      status: 'ADDED',
    }),
    bandMember({
      id: 'm-declined',
      contactId: 'c5',
      contact: { id: 'c5', name: 'Amir Osei', email: null },
      status: 'DECLINED',
    }),
    bandMember({
      id: 'm-self',
      contactId: 'c4',
      contact: { id: 'c4', name: 'You (the musician)', email: null },
      status: 'CONFIRMED',
      isSelf: true,
    }),
  ],
};

const meta = {
  component: BandCard,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  args: {
    band,
    packages,
    hasLineupTemplates: false,
  },
} satisfies Meta<typeof BandCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GroupedByAnswer: Story = {
  play: async ({ canvas }) => {
    // Grouped by answer, in order — Confirmed, Waiting on, Still to sort, Chairs to fill.
    await expect(canvas.getByText('Confirmed')).toBeVisible();
    await expect(canvas.getByText('Waiting on')).toBeVisible();
    await expect(canvas.getByText('Still to sort')).toBeVisible();
    await expect(canvas.getByText('Chairs to fill')).toBeVisible();

    // Dave fills two chairs but appears once, with both roles on his chip.
    await expect(canvas.getAllByText('Dave Chambers')).toHaveLength(1);
    await expect(canvas.getByText('Vocals, Sax')).toBeVisible();

    await expect(canvas.getByText('Priya Shah')).toBeVisible();
    await expect(canvas.getByText('Leo Novak')).toBeVisible();
    await expect(canvas.getByText('Guitar')).toBeVisible();

    // Declined shares "Still to sort" with never-invited members, but a badge keeps their answer
    // legible rather than flattening both into the same look.
    await expect(canvas.getByText('Amir Osei')).toBeVisible();
    await expect(canvas.getByText('Declined')).toBeVisible();

    // The isSelf member, filling no chair, reads plain "You".
    await expect(canvas.getByText('You')).toBeVisible();

    // The vacant chair renders as a badge, not a player.
    await expect(canvas.getByText('Keys · Whole day')).toBeVisible();
  },
};

export const NoBandYet: Story = {
  args: {
    band: { chairs: [], members: [] },
    hasLineupTemplates: false,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('No band yet')).toBeVisible();
    await expect(canvas.getByText('Add chairs to start building the roster.')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Add band' })).toBeVisible();
  },
};

export const NoBandYetWithLineups: Story = {
  name: 'Empty state offers a lineup when one exists',
  args: {
    band: { chairs: [], members: [] },
    hasLineupTemplates: true,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Apply a lineup, or add chairs one at a time.')).toBeVisible();
  },
};
