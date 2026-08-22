import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, screen, userEvent, within } from 'storybook/test';
import { BandAtom } from './BandAtom';
import { bandMember, lineupTemplate } from '@/test/factories';
import type { BookingBandChair, BookingLineup, BookingPackageSummary } from '@/types/api';

// The Band atom is presentational: it owns no mutation and no fetch. The host (BandSheet) passes
// the chairs/members/packages/lineup templates and signals every edit via a callback. One row per
// member (segment chips for every chair they fill), plus the unfilled-chair block from #884 (#885).

const packages: BookingPackageSummary[] = [{ id: 'pkg-evening', order: 1, label: 'Evening', icon: 'guitar' }];

const bandLineups: BookingLineup[] = [
  { id: 'lu-evening', label: null, packageIds: ['pkg-evening'] },
  { id: 'lu-whole-day', label: null, packageIds: [] },
];

const chairs: BookingBandChair[] = [
  { id: 'ch1', role: 'Saxophone', order: 1, lineupId: 'lu-evening', memberId: null, callTime: '19:30' },
  { id: 'ch2', role: 'Drums', order: 1, lineupId: 'lu-whole-day', memberId: null, callTime: null },
];

const filledChairs: BookingBandChair[] = [
  { id: 'ch3', role: 'Vocals', order: 1, lineupId: 'lu-evening', memberId: 'm1', callTime: '19:30' },
  { id: 'ch4', role: 'Guitar', order: 1, lineupId: 'lu-whole-day', memberId: 'm1', callTime: null },
  { id: 'ch5', role: 'Drums', order: 2, lineupId: 'lu-whole-day', memberId: null, callTime: null },
];

const members = [
  bandMember({
    id: 'm1',
    contactId: 'c1',
    contact: { id: 'c1', name: 'Dave Chambers', email: 'dave@example.com' },
    status: 'CONFIRMED',
    sessionFee: '150.00',
  }),
];

const lineups = [
  lineupTemplate({
    id: 'lineup1',
    label: 'My five-piece',
    slots: [
      { id: 'ls1', role: 'Sax', order: 0 },
      { id: 'ls2', role: 'Drums', order: 1 },
    ],
  }),
];

const meta = {
  component: BandAtom,
  tags: ['ai-generated'],
  args: {
    lineups: bandLineups,
    chairs,
    members: [],
    packages,
    venue: null,
    instrumentVocabulary: ['Bass', 'Drums', 'Sax', 'Vocals'],
    lineupTemplates: lineups,
    lineupTemplatesLoading: false,
    onApplyLineup: fn(),
    isApplyingLineup: false,
    onAddChair: fn(),
    isAddingChair: false,
    onRemoveChair: fn(),
    removingChairId: null,
    onMoveChair: fn(),
    onAssignChair: fn(),
    assigningChairId: null,
    onChangeMemberStatus: fn(),
    changingStatusMemberId: null,
    onSaveMemberFee: fn(),
    savingFeeMemberId: null,
    onRemoveMember: fn(),
    removingMemberId: null,
  },
} satisfies Meta<typeof BandAtom>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithChairs: Story = {
  name: 'Chairs to fill, with a call time derived on one and absent on the package-less one',
  args: { lineups: bandLineups },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Chairs to fill')).toBeVisible();
    await expect(canvas.getByText('Saxophone')).toBeVisible();
    await expect(canvas.getByText('Evening')).toBeVisible();
    await expect(canvas.getByText('19:30')).toBeVisible();
    await expect(canvas.getByText('Drums')).toBeVisible();
    // "Whole day" appears twice: the segment-picker trigger (default selection) and the
    // package-less chair's row.
    await expect(canvas.getAllByText('Whole day')).toHaveLength(2);
  },
};

export const ApplyLineup: Story = {
  name: 'Picking a lineup chip applies it to the selected segment',
  args: { chairs: [] },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No band yet')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'My five-piece' }));
    // Default segment is "Whole day" — package-less (null).
    await expect(args.onApplyLineup).toHaveBeenCalledWith('lineup1', null);
  },
};

export const AddChairToSegment: Story = {
  name: 'Choosing a segment then adding a chair targets that segment',
  args: { chairs: [] },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText('Segment'));
    // Radix Select renders its options in a portal, outside canvasElement.
    await userEvent.click(await screen.findByRole('option', { name: 'Evening' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Add a chair' }));
    await userEvent.type(canvas.getByPlaceholderText('e.g. Saxophone'), 'Trumpet');
    await userEvent.click(canvas.getByRole('button', { name: 'Add' }));
    await expect(args.onAddChair).toHaveBeenCalledWith('Trumpet', 'pkg-evening');
  },
};

export const Empty: Story = {
  args: { chairs: [], lineupTemplates: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('No band yet')).toBeVisible();
    await expect(canvas.getByText('Apply a lineup, or add chairs one at a time.')).toBeVisible();
  },
};

// #885: one member row, segment-chip per chair they fill, plus the remaining vacant chair still
// showing in "Chairs to fill" — the split at the heart of this slice.
export const WithMembers: Story = {
  name: 'One member row with segment chips, alongside a still-vacant chair',
  args: { chairs: filledChairs, members },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Band')).toBeVisible();
    await expect(canvas.getByText('Dave Chambers')).toBeVisible();
    // "Confirmed" appears twice: the read-only StatusPill and the status Select's current value.
    await expect(canvas.getAllByText('Confirmed')).toHaveLength(2);
    await expect(canvas.getByText('Vocals · Evening')).toBeVisible();
    await expect(canvas.getByText('Guitar · Whole day')).toBeVisible();
    await expect(canvas.getByText('£150.00')).toBeVisible();
    await expect(canvas.getByText('Chairs to fill')).toBeVisible();
    await expect(canvas.getByText('Drums')).toBeVisible();
  },
};

// Story task before the component build (issue #885): assigning a contact to a vacant chair.
export const AssignContactToChair: Story = {
  name: 'Picking a contact from the ContactPicker on a vacant chair assigns it',
  args: { chairs: [{ id: 'ch1', role: 'Saxophone', order: 1, lineupId: 'lu-whole-day', memberId: null, callTime: null }] },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('combobox', { name: 'Fill this chair...' }));
    await userEvent.click(await screen.findByRole('option', { name: /Sophie Hartley/i }));
    await expect(args.onAssignChair).toHaveBeenCalledWith('ch1', 'c2');
  },
};

export const UnassignFromMemberRow: Story = {
  name: 'Removing a segment chip vacates that chair',
  args: { chairs: filledChairs, members },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText('Unassign Vocals'));
    await expect(args.onAssignChair).toHaveBeenCalledWith('ch3', null);
  },
};

export const RemoveMember: Story = {
  args: { chairs: filledChairs, members },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText('Remove member'));
    await expect(args.onRemoveMember).toHaveBeenCalledWith('m1');
  },
};
