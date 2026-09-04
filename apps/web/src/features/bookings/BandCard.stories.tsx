import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import BandCard from './BandCard';
import { bandMember } from '@/test/factories';
import type { BookingBand, BookingBandChair } from '@/types/api';

// Band members v1 (#879, ADR-0072 §6, #887): the Info tab's directory, grouped by answer rather
// than a flat list. Confirmed · Waiting on · Still to sort · Parts to fill, empty groups omitted.

const chairs: BookingBandChair[] = [
  { id: 'ch1', role: 'Vocals', order: 1, lineupId: 'lu-evening', memberId: 'm-confirmed', callTimes: [{ segmentId: 'pkg-evening', segmentLabel: 'Evening Party', startTime: '19:30' }] },
  { id: 'ch2', role: 'Sax', order: 2, lineupId: 'lu-evening', memberId: 'm-confirmed', callTimes: [{ segmentId: 'pkg-evening', segmentLabel: 'Evening Party', startTime: '19:30' }] },
  { id: 'ch3', role: 'Guitar', order: 3, lineupId: 'lu-evening', memberId: 'm-invited', callTimes: [{ segmentId: 'pkg-evening', segmentLabel: 'Evening Party', startTime: '19:30' }] },
  { id: 'ch4', role: 'Drums', order: 4, lineupId: 'lu-evening', memberId: 'm-added', callTimes: [{ segmentId: 'pkg-evening', segmentLabel: 'Evening Party', startTime: '19:30' }] },
  { id: 'ch5', role: 'Keys', order: 5, lineupId: 'lu-evening', memberId: null, callTimes: [{ segmentId: 'pkg-evening', segmentLabel: 'Evening Party', startTime: '19:30' }] },
  { id: 'ch6', role: 'Cello', order: 5, lineupId: 'lu-evening', memberId: 'm-declined', callTimes: [{ segmentId: 'pkg-evening', segmentLabel: 'Evening Party', startTime: '19:30' }] },
];

const band: BookingBand = {
  // ONE band on this booking — so no part badge names it (#983's suppression rule). Before #987
  // this fixture held two unnamed Lineups for one roster, which is exactly the shape the collapse
  // removed.
  lineups: [{ id: 'lu-evening', label: 'My six-piece', packageIds: ['pkg-evening'] }],
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
    hasLineupTemplates: false,
  },
} satisfies Meta<typeof BandCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GroupedByAnswer: Story = {
  play: async ({ canvas }) => {
    // Grouped by answer, in order — Confirmed, Waiting on, Still to sort, Parts to fill.
    await expect(canvas.getByText('Confirmed')).toBeVisible();
    await expect(canvas.getByText('Waiting on')).toBeVisible();
    await expect(canvas.getByText('Still to sort')).toBeVisible();
    await expect(canvas.getByText('Parts to fill')).toBeVisible();

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

    // The vacant part renders as a badge, not a player — and #987/#983's rule means the badge is
    // the bare role, because this booking has ONE band. The segment suffix that used to hang off
    // every badge (and had to be de-duplicated by eye, #979) is gone.
    await expect(canvas.getByText('Keys')).toBeVisible();
    await expect(canvas.queryByText(/Keys · /)).not.toBeInTheDocument();
  },
};

export const NoBandYet: Story = {
  args: {
    band: { lineups: [], chairs: [], members: [] },
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
    band: { lineups: [], chairs: [], members: [] },
    hasLineupTemplates: true,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Apply a lineup, or add chairs one at a time.')).toBeVisible();
  },
};

// #987 / #983: the other half of the badge rule. With TWO bands on the booking a bare role no
// longer says which one a vacancy belongs to, so — and only then — the badge names it.
export const TwoBandsNameTheirParts: Story = {
  name: 'Two bands on one booking — vacancy badges name theirs',
  args: {
    band: {
      lineups: [
        { id: 'lu-solo', label: 'Ceremony solo', packageIds: ['pkg-ceremony'] },
        { id: 'lu-six', label: 'My six-piece', packageIds: ['pkg-evening'] },
      ],
      chairs: [
        { id: 'ch-piano', role: 'Piano', order: 1, lineupId: 'lu-solo', memberId: null, callTimes: [{ segmentId: 'pkg-ceremony', segmentLabel: 'Ceremony', startTime: '13:00' }] },
        { id: 'ch-keys', role: 'Keys', order: 1, lineupId: 'lu-six', memberId: null, callTimes: [{ segmentId: 'pkg-evening', segmentLabel: 'Evening Party', startTime: '19:30' }] },
      ],
      members: [],
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Piano · Ceremony solo')).toBeVisible();
    await expect(canvas.getByText('Keys · My six-piece')).toBeVisible();
  },
};
