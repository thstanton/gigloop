import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, screen, userEvent, within } from 'storybook/test';
import { BandMemberRow } from './BandMemberRow';
import { bandMember } from '@/test/factories';
import type { BookingBandChair, BookingPackageSummary } from '@/types/api';

// One row per person on this gig (ADR-0072 §2/§5, #885): segment chips for every chair they fill,
// status, and their per-person fee. Presentational — the host (BandAtom) wires every edit.

const packages: BookingPackageSummary[] = [{ id: 'pkg-evening', order: 1, label: 'Evening', icon: 'guitar' }];

const chairs: BookingBandChair[] = [
  { id: 'ch3', role: 'Vocals', order: 1, packageId: 'pkg-evening', memberId: 'm1', callTime: '19:30' },
  { id: 'ch4', role: 'Guitar', order: 2, packageId: null, memberId: 'm1', callTime: null },
];

const member = bandMember({
  id: 'm1',
  contactId: 'c1',
  contact: { id: 'c1', name: 'Dave Chambers', email: 'dave@example.com' },
  status: 'CONFIRMED',
  sessionFee: '150.00',
});

const meta = {
  component: BandMemberRow,
  tags: ['ai-generated'],
  args: {
    member,
    chairs,
    packages,
    onUnassignChair: fn(),
    onChangeStatus: fn(),
    isChangingStatus: false,
    onSaveFee: fn(),
    isSavingFee: false,
    onRemove: fn(),
    isRemoving: false,
  },
} satisfies Meta<typeof BandMemberRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Dave Chambers')).toBeVisible();
    await expect(canvas.getByText('Vocals · Evening')).toBeVisible();
    await expect(canvas.getByText('Guitar · Whole day')).toBeVisible();
    await expect(canvas.getByText('£150.00')).toBeVisible();
  },
};

export const IsSelf: Story = {
  args: { member: { ...member, isSelf: true } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('You')).toBeVisible();
  },
};

export const ChangeStatus: Story = {
  name: 'Picking a status from the Select fires onChangeStatus',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText('Status'));
    // Radix Select renders its options in a portal, outside canvasElement.
    await userEvent.click(await screen.findByRole('option', { name: 'Declined' }));
    await expect(args.onChangeStatus).toHaveBeenCalledWith('DECLINED');
  },
};

export const UnassignChair: Story = {
  name: 'Removing a segment chip vacates that chair',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText('Unassign Vocals'));
    await expect(args.onUnassignChair).toHaveBeenCalledWith('ch3');
  },
};

export const EditFee: Story = {
  name: 'Editing the fee shows Saving…, then onSaveFee fires with the parsed number',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText('£150.00'));
    const input = canvas.getByPlaceholderText('Fee');
    await userEvent.clear(input);
    await userEvent.type(input, '200');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await expect(args.onSaveFee).toHaveBeenCalledWith(200);
  },
};

export const RemoveMember: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText('Remove member'));
    await expect(args.onRemove).toHaveBeenCalled();
  },
};
