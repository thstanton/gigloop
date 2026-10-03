import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import { PlayersListCard } from './PlayersListCard';
import { bandMember } from '@/test/factories';
import type { BookingBand, BookingBandChair, BookingBandMember, BookingPackageSummary } from '@/types/api';

// #1057 (ADR-0084 §2, canvas artboard 2): the Players card — *where do I stand with each person*.
// One story per canvas state, all on the canvas's wedding: the organiser (Keys), Ana Rossi (Bass) and
// Ben Carter (Sax) confirmed, Priya Shah (Guitar) invited, Drums still to fill on the evening.

const packages: BookingPackageSummary[] = [
  { id: 'pkg-dri', order: 0, label: 'Drinks', icon: 'glass' },
  { id: 'pkg-wb', order: 1, label: 'Wedding breakfast', icon: 'utensils' },
  { id: 'pkg-eve', order: 2, label: 'Evening', icon: 'guitar' },
];

const part = (id: string, role: string, lineupId: string, order: number, memberId: string | null): BookingBandChair => ({
  id,
  role,
  order,
  lineupId,
  memberId,
  callTimes: [],
});

const lineups = [
  { id: 'lu-day', label: 'Day lineup', packageIds: ['pkg-dri', 'pkg-wb'] },
  { id: 'lu-eve', label: 'Evening lineup', packageIds: ['pkg-eve'] },
];

const self = bandMember({
  id: 'm-self',
  contactId: 'c-self',
  contact: { id: 'c-self', name: 'Tim Stanton', email: null },
  status: 'CONFIRMED',
  isSelf: true,
});
const ana = bandMember({
  id: 'm-ana',
  contactId: 'c-ana',
  contact: { id: 'c-ana', name: 'Ana Rossi', email: 'ana@example.com' },
  status: 'CONFIRMED',
  sessionFee: '220',
  invitedAt: '2026-09-20T10:00:00Z',
});
const ben = bandMember({
  id: 'm-ben',
  contactId: 'c-ben',
  contact: { id: 'c-ben', name: 'Ben Carter', email: 'ben@example.com' },
  status: 'CONFIRMED',
  sessionFee: '220',
  invitedAt: '2026-09-20T10:00:00Z',
});
const priya = bandMember({
  id: 'm-priya',
  contactId: 'c-priya',
  contact: { id: 'c-priya', name: 'Priya Shah', email: 'priya@example.com' },
  status: 'INVITED',
  sessionFee: '150',
  invitedAt: '2026-10-01T10:00:00Z',
});

const weddingChairs: BookingBandChair[] = [
  part('d-keys', 'Keys', 'lu-day', 0, 'm-self'),
  part('d-bass', 'Bass', 'lu-day', 1, 'm-ana'),
  part('d-sax', 'Sax', 'lu-day', 2, 'm-ben'),
  part('e-keys', 'Keys', 'lu-eve', 0, 'm-self'),
  part('e-bass', 'Bass', 'lu-eve', 1, 'm-ana'),
  part('e-sax', 'Sax', 'lu-eve', 2, 'm-ben'),
  part('e-guitar', 'Guitar', 'lu-eve', 3, 'm-priya'),
  part('e-drums', 'Drums', 'lu-eve', 4, null),
];

const wedding: BookingBand = { lineups, chairs: weddingChairs, members: [self, ana, ben, priya] };

const meta = {
  component: PlayersListCard,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  args: {
    band: wedding,
    packages,
    backHref: '/admin/bookings/b1',
    onOpenBandSheet: fn(),
    changingStatusMemberId: null,
    savingFeeMemberId: null,
    takingOffMemberId: null,
    onInviteMember: fn(),
    onChangeStatus: fn(),
    onSaveFee: fn(),
    onTakeOff: fn(),
    onComposeCommunication: fn(),
  },
} satisfies Meta<typeof PlayersListCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The canvas wedding as artboard 2 draws it: three answer groups, then the part nobody holds. */
export const FullGig: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Players')).toBeVisible();
    // Groups appear in the contract's order: Confirmed, Waiting on, then Still to fill.
    const headings = canvas.getAllByText(/^(Confirmed|Waiting on|Still to sort|Still to fill)$/).map((el) => el.textContent);
    await expect(headings).toEqual(['Confirmed', 'Waiting on', 'Still to fill']);
    await expect(canvas.getByRole('button', { name: 'Edit who plays what' })).toBeVisible();
    await expect(canvas.getByText('Confirmed')).toBeVisible();
    await expect(canvas.getByText('Waiting on')).toBeVisible();
    await expect(canvas.getByText('Still to fill')).toBeVisible();
    // No one is unsorted on this gig, so that group stays hidden.
    await expect(canvas.queryByText('Still to sort')).not.toBeInTheDocument();

    await expect(canvas.getByText('Ana Rossi')).toBeVisible();
    await expect(canvas.getByText('Bass · Drinks, Wedding breakfast, Evening')).toBeVisible();
    await expect(canvas.getByText('Guitar · Evening')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Edit fee for Ana Rossi' })).toHaveTextContent('£220');

    // Still to fill: the role, the package, the action.
    await expect(canvas.getByText('Drums')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Find a player' })).toBeVisible();

    // Your own row: "You", no menu, no fee.
    await expect(canvas.queryByRole('button', { name: /Actions for Tim/ })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /fee for Tim/ })).not.toBeInTheDocument();

    // Words the vocabulary bans never appear.
    await expect(canvas.queryByText(/chair|roster|Whole day|call time/i)).not.toBeInTheDocument();
  },
};

/** Artboard 2's open `⋯` menu on Ana Rossi, including the temporary sends A4 will move. */
export const MenuOpen: Story = {
  play: async ({ canvas, userEvent: user }) => {
    // ActionMenu renders a mobile and a desktop trigger (CSS shows one); the first is the mobile one.
    await user.click(canvas.getAllByRole('button', { name: 'Actions for Ana Rossi' })[0]);
    // The menu is portalled out of the canvas, so query the document.
    const menu = within(document.body);
    await waitFor(() => expect(menu.getByText('Resend invitation')).toBeVisible());
    await expect(menu.getByText("Preview Ana's portal")).toBeVisible();
    await expect(menu.getByText('Change fee')).toBeVisible();
    await expect(menu.getByText('Change answer…')).toBeVisible();
    await expect(menu.getByText('Send call sheet')).toBeVisible();
    await expect(menu.getByText('Send final details')).toBeVisible();
    await expect(menu.getByText('Take off this gig…')).toBeVisible();
  },
};

/** Nobody has answered yet: a lone invited player, so only "Waiting on" shows. */
export const WaitingOnly: Story = {
  args: {
    band: {
      lineups,
      chairs: [part('e-guitar', 'Guitar', 'lu-eve', 0, 'm-priya')],
      members: [priya],
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Waiting on')).toBeVisible();
    await expect(canvas.queryByText('Confirmed')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Still to sort')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Still to fill')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /^Invite / })).not.toBeInTheDocument();
  },
};

/** The flag is on, nobody is on the gig and no part exists yet. */
export const NobodyYet: Story = {
  args: { band: { lineups: [], chairs: [], members: [] } },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByText('No players yet')).toBeVisible();
    await expect(canvas.getByText('Choose a lineup for each part of the day, then fill its parts.')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Choose a lineup' }));
    await expect(args.onOpenBandSheet).toHaveBeenCalled();
    await expect(canvas.queryByText('Players')).not.toBeInTheDocument();
  },
};

/** Only you play: Confirmed with your row alone — no menu, fee, answer or Invite. */
export const OnlySelf: Story = {
  args: {
    band: { lineups, chairs: [part('d-keys', 'Keys', 'lu-day', 0, 'm-self')], members: [self] },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Confirmed')).toBeVisible();
    await expect(canvas.getByText('You', { selector: 'span.font-semibold' })).toBeVisible();
    await expect(canvas.getByText('Keys · Drinks, Wedding breakfast')).toBeVisible();
    await expect(canvas.queryByText('Waiting on')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Still to sort')).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /Actions for/ })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /^Invite/ })).not.toBeInTheDocument();
  },
};

const declined: BookingBandMember = bandMember({
  id: 'm-amir',
  contactId: 'c-amir',
  contact: { id: 'c-amir', name: 'Amir Osei', email: null },
  status: 'DECLINED',
  invitedAt: '2026-09-28T10:00:00Z',
});
const neverInvited: BookingBandMember = bandMember({
  id: 'm-leo',
  contactId: 'c-leo',
  contact: { id: 'c-leo', name: 'Leo Novak', email: null },
  status: 'ADDED',
});

/** "Still to sort" holds the declined (a Declined badge, no Invite) and the never-invited (Invite). */
export const DeclinedPlayer: Story = {
  args: {
    band: {
      lineups,
      chairs: [part('e-cello', 'Cello', 'lu-eve', 0, 'm-amir'), part('e-drums', 'Drums', 'lu-eve', 1, 'm-leo')],
      members: [declined, neverInvited],
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Still to sort')).toBeVisible();
    await expect(canvas.getByText('Declined')).toBeVisible();
    // Action required: the declined player's name is struck through.
    await expect(canvas.getByText('Amir Osei')).toHaveClass('line-through');
    await expect(canvas.getByText('Leo Novak')).not.toHaveClass('line-through');
    // Invite is on the row of the never-invited player only.
    await expect(canvas.getByRole('button', { name: 'Invite Leo Novak' })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Invite Amir Osei' })).not.toBeInTheDocument();
  },
};

// Behaviour that moved here from the Band sheet (#1057): each per-player action fires its callback.
export const RowActionsFire: Story = {
  args: {
    band: {
      lineups,
      chairs: [part('e-cello', 'Cello', 'lu-eve', 0, 'm-amir'), part('e-drums', 'Drums', 'lu-eve', 1, 'm-leo')],
      members: [declined, neverInvited],
    },
  },
  play: async ({ canvas, args }) => {
    const body = within(document.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Invite Leo Novak' }));
    await expect(args.onInviteMember).toHaveBeenCalledWith('m-leo');

    // Change answer… → pick a status.
    await userEvent.click(canvas.getAllByRole('button', { name: 'Actions for Amir Osei' })[0]);
    await userEvent.click(await body.findByText('Change answer…'));
    await userEvent.click(await body.findByRole('button', { name: 'Invited' }));
    await expect(args.onChangeStatus).toHaveBeenCalledWith('m-amir', 'INVITED');

    // Change fee opens the inline editor from the menu.
    await userEvent.click(canvas.getAllByRole('button', { name: 'Actions for Leo Novak' })[0]);
    await userEvent.click(await body.findByText('Change fee'));
    await userEvent.type(await canvas.findByRole('spinbutton', { name: 'fee for Leo Novak amount' }), '180');
    await userEvent.click(canvas.getByRole('button', { name: 'Save fee for Leo Novak' }));
    await expect(args.onSaveFee).toHaveBeenCalledWith('m-leo', 180);

    // Take off this gig… names the parts they hold, then confirms.
    await userEvent.click(canvas.getAllByRole('button', { name: 'Actions for Amir Osei' })[0]);
    await userEvent.click(await body.findByText('Take off this gig…'));
    await expect(await body.findByText(/This empties Cello/)).toBeVisible();
    await userEvent.click(body.getByRole('button', { name: 'Take off this gig' }));
    await expect(args.onTakeOff).toHaveBeenCalledWith('m-amir');
  },
};

// The temporary per-player sends (until A4, #1058) target one player at a time.
export const TemporarySendsArePerPlayer: Story = {
  play: async ({ canvas, args }) => {
    const body = within(document.body);
    await userEvent.click(canvas.getAllByRole('button', { name: 'Actions for Ana Rossi' })[0]);
    await userEvent.click(await body.findByText('Send call sheet'));
    await expect(args.onComposeCommunication).toHaveBeenNthCalledWith(1, 'm-ana', 'call-sheet');
    await userEvent.click(canvas.getAllByRole('button', { name: 'Actions for Ana Rossi' })[0]);
    await userEvent.click(await body.findByText('Send final details'));
    await expect(args.onComposeCommunication).toHaveBeenNthCalledWith(2, 'm-ana', 'final-details');
  },
};
