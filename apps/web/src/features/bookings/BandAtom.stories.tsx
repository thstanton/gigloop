import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, screen, userEvent, within } from 'storybook/test';
import { BandAtom } from './BandAtom';
import { bandMember, lineupTemplate } from '@/test/factories';
import type { BookingBandChair, BookingChairCallTime, BookingPackageSummary } from '@/types/api';

// The Band atom is presentational: it owns no mutation and no fetch. The host (BandSheet) passes
// the lineups/chairs/members/packages and signals every edit via a callback.
//
// These are #983's resolved story states, built for #987. States 1-7 are the data shapes (smoke);
// 8-11 are the interactions. The one they all exist to prove is `OneLineupManySegments`: **four
// parts, not eight**, for a four-piece playing two sets.

const DRINKS = 'pkg-drinks';
const EVENING = 'pkg-evening';

const twoSegments: BookingPackageSummary[] = [
  { id: DRINKS, order: 1, label: 'Drinks Reception', icon: 'guitar' },
  { id: EVENING, order: 2, label: 'Evening Party', icon: 'guitar' },
];

const fourPieceRoles = ['Vocals', 'Guitar', 'Bass', 'Drums'];

// The server derives one call time per segment a band plays, in the booking's package order — a
// band on both sets is called twice, and the part row shows both. These fixtures mirror that:
// a story whose Lineup plays one segment must pass that segment's call alone, or the row claims a
// call the booking does not have.
const DRINKS_CALL: BookingChairCallTime = { segmentId: DRINKS, segmentLabel: 'Drinks Reception', startTime: '18:00' };
const EVENING_CALL: BookingChairCallTime = { segmentId: EVENING, segmentLabel: 'Evening Party', startTime: '20:30' };
const BOTH_CALLS = [DRINKS_CALL, EVENING_CALL];
/** The package-less bucket: no Package names it, so `callTimeParts` says "Whole gig" instead. */
const WHOLE_GIG_CALL: BookingChairCallTime = { segmentId: null, segmentLabel: null, startTime: '18:00' };

/** Four parts in ONE band — the collapse ADR-0081 exists for. */
const fourPieceChairs = (
  lineupId: string,
  memberIds: Array<string | null> = [null, null, null, null],
  callTimes: BookingChairCallTime[] = BOTH_CALLS,
): BookingBandChair[] =>
  fourPieceRoles.map((role, i) => ({
    id: `ch-${lineupId}-${i}`,
    role,
    order: i + 1,
    lineupId,
    memberId: memberIds[i] ?? null,
    callTimes,
  }));

const sam = bandMember({
  id: 'm-sam',
  contactId: 'c-sam',
  contact: { id: 'c-sam', name: 'Sam Okonkwo', email: 'sam@example.com' },
  status: 'CONFIRMED',
  sessionFee: '180.00',
});

const ana = bandMember({
  id: 'm-ana',
  contactId: 'c-ana',
  contact: { id: 'c-ana', name: 'Ana Reis', email: 'ana@example.com' },
  status: 'INVITED',
  sessionFee: null,
});

const lineupTemplates = [
  lineupTemplate({
    id: 'lt-four',
    label: 'My four-piece',
    slots: fourPieceRoles.map((role, i) => ({ id: `ls${i}`, role, order: i })),
  }),
];

const meta = {
  component: BandAtom,
  tags: ['ai-generated'],
  args: {
    lineups: [],
    chairs: [],
    members: [],
    packages: twoSegments,
    venue: null,
    instrumentVocabulary: ['Bass', 'Drums', 'Saxophone', 'Vocals'],
    lineupTemplates,
    lineupTemplatesLoading: false,
    onApplyLineup: fn(),
    isApplyingLineup: false,
    onSetLineupSegments: fn(),
    isSettingLineupSegments: false,
    onRemoveLineup: fn(),
    removingLineupId: null,
    onAddChair: fn(),
    isAddingChair: false,
    onRemoveChair: fn(),
    removingChairId: null,
    onAssignChair: fn(),
    assigningChairId: null,
    onChangeMemberStatus: fn(),
    changingStatusMemberId: null,
    onSaveMemberFee: fn(),
    savingFeeMemberId: null,
  },
} satisfies Meta<typeof BandAtom>;

export default meta;
type Story = StoryObj<typeof meta>;

// ── 1 ─────────────────────────────────────────────────────────────────────────
export const OneLineupWholeGig: Story = {
  name: '1. One band, no packages on the booking — plays the whole gig, no band name on any part',
  args: {
    packages: [],
    lineups: [{ id: 'lu-1', label: 'My four-piece', packageIds: [] }],
    chairs: fourPieceChairs('lu-1', undefined, [WHOLE_GIG_CALL]),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Plays the whole gig')).toBeVisible();
    // The suppression rule: one band on the booking, so its name never appears on a part row —
    // only as the Lineups card's own row.
    await expect(canvas.getAllByText('My four-piece')).toHaveLength(1);
  },
};

// ── 2 ─── THE ONE #987 EXISTS FOR ────────────────────────────────────────────
export const OneLineupManySegments: Story = {
  name: '2. One band playing two sets — FOUR parts, not eight (#979’s founding complaint)',
  args: {
    lineups: [{ id: 'lu-1', label: 'My four-piece', packageIds: [DRINKS, EVENING] }],
    chairs: fourPieceChairs('lu-1'),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The plays line names both sets…
    await expect(canvas.getByText('Plays Drinks Reception and Evening Party')).toBeVisible();
    // …and there are FOUR parts, not eight. Before #987 this booking produced two Lineups and
    // eight chairs, which the musician de-duplicated by reading a segment suffix on every badge.
    await expect(canvas.getByText('4 parts · 4 still to fill')).toBeVisible();
    for (const role of fourPieceRoles) {
      await expect(canvas.getAllByText(role)).toHaveLength(1);
    }
  },
};

// ── 3 ─────────────────────────────────────────────────────────────────────────
export const TwoLineups: Story = {
  name: '3. Ceremony solo + reception seven-piece, one person in both — ONE player row, two parts',
  args: {
    lineups: [
      { id: 'lu-solo', label: 'Ceremony solo', packageIds: [DRINKS] },
      { id: 'lu-seven', label: 'My seven-piece', packageIds: [EVENING] },
    ],
    chairs: [
      { id: 'ch-piano', role: 'Piano', order: 1, lineupId: 'lu-solo', memberId: 'm-sam', callTimes: [DRINKS_CALL] },
      { id: 'ch-keys', role: 'Keys', order: 1, lineupId: 'lu-seven', memberId: 'm-sam', callTimes: [EVENING_CALL] },
      { id: 'ch-bass', role: 'Bass', order: 2, lineupId: 'lu-seven', memberId: null, callTimes: [EVENING_CALL] },
    ],
    members: [sam],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // ADR-0072 §2 / journey ②'s discriminator: ONE row for Sam, however many bands they play in.
    await expect(canvas.getAllByText('Sam Okonkwo')).toHaveLength(1);
    // Both their parts hang beneath that one row…
    await expect(canvas.getByText('Piano')).toBeVisible();
    await expect(canvas.getByText('Keys')).toBeVisible();
    // …and now that the booking has two bands, part rows name theirs.
    await expect(canvas.getAllByText('Ceremony solo').length).toBeGreaterThan(1);
  },
};

// ── 4 ─────────────────────────────────────────────────────────────────────────
export const AllPartsFilled: Story = {
  name: '4. Every part filled — the card says so rather than disappearing, and still offers + Add a part',
  args: {
    lineups: [{ id: 'lu-1', label: 'My four-piece', packageIds: [DRINKS, EVENING] }],
    chairs: fourPieceChairs('lu-1', ['m-sam', 'm-ana', 'm-sam', 'm-ana']),
    members: [sam, ana],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Parts to fill · all filled')).toBeVisible();
    await expect(canvas.getByText('Every part on this gig has somebody playing it')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Add a part' })).toBeVisible();
  },
};

// ── 5 ─────────────────────────────────────────────────────────────────────────
export const NoLineupYet: Story = {
  name: '5. Booking has packages but no band — empty state offers the two writes, and no "Decide later"',
  args: { lineups: [], chairs: [], members: [] },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No band yet')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Add a lineup' })).toBeVisible();
    // #983's first ruling: opening this sheet IS "later", so nothing here writes nothing.
    await expect(canvas.queryByText(/decide later/i)).not.toBeInTheDocument();

    // "Add a part" must ASK for the role. It used to add one called "Vocals" the musician never
    // named — the empty state hardcoded it while the card's own footer prompted properly.
    await userEvent.click(canvas.getByRole('button', { name: 'Add a part' }));
    // `getByLabelText`, not `getByRole('textbox')`: the role field carries a `list` for the
    // instrument type-ahead, which gives the input an implicit combobox role.
    await expect(canvas.getByLabelText('Part')).toBeVisible();
    await expect(args.onAddChair).not.toHaveBeenCalled();

    await userEvent.type(canvas.getByLabelText('Part'), 'Saxophone');
    await userEvent.click(canvas.getByRole('button', { name: 'Add part' }));
    await expect(args.onAddChair).toHaveBeenCalledWith('Saxophone', null);
  },
};

// ── 6 ─────────────────────────────────────────────────────────────────────────
export const UnnamedLineup: Story = {
  name: '6. A band built one part at a time, with no template behind it, renders as "Band"',
  args: {
    packages: [],
    lineups: [{ id: 'lu-1', label: null, packageIds: [] }],
    chairs: [{ id: 'ch1', role: 'Saxophone', order: 1, lineupId: 'lu-1', memberId: null, callTimes: [] }],
    lineupTemplates: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Band')).toBeVisible();
    // No call time anywhere on the booking — absent, not zero.
    await expect(canvas.getByText('No call time')).toBeVisible();
  },
};

// ── 7 ─────────────────────────────────────────────────────────────────────────
export const LineupPlayingNothing: Story = {
  name: '7. A band on a packaged booking with no sets linked — "Plays nothing yet", in the warning tone',
  args: {
    lineups: [{ id: 'lu-1', label: 'My four-piece', packageIds: [] }],
    // A band playing nothing is called to nothing — its parts read "No call time", they do not
    // borrow the whole-gig reading that the same empty `packageIds` earns in story 1.
    chairs: fourPieceChairs('lu-1', undefined, []),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The same empty `packageIds` that reads "Plays the whole gig" in story 1 — the booking having
    // packages is what makes it mean something else (ADR-0081 §4).
    await expect(canvas.getByText('Plays nothing yet')).toBeVisible();
    await expect(canvas.getAllByText('No call time')).toHaveLength(4);
  },
};

// ── 8 ─────────────────────────────────────────────────────────────────────────
export const ChangeStatus: Story = {
  name: '8. The status pill IS the dropdown — four options, a tick on the current one',
  args: {
    lineups: [{ id: 'lu-1', label: 'My four-piece', packageIds: [DRINKS, EVENING] }],
    chairs: fourPieceChairs('lu-1', ['m-sam', 'm-sam', null, null]),
    members: [sam],
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // The pill is the trigger: the status word appears once, in the thing you press.
    const trigger = canvas.getByRole('button', { name: 'Status for Sam Okonkwo' });
    await expect(trigger).toHaveTextContent('Confirmed');
    await userEvent.click(trigger);

    const menu = within(await screen.findByRole('menu'));
    await expect(menu.getAllByRole('menuitem')).toHaveLength(4);

    await userEvent.click(menu.getByRole('menuitem', { name: /Declined/ }));
    await expect(args.onChangeMemberStatus).toHaveBeenCalledWith('m-sam', 'DECLINED');

    // Their other parts are untouched — the status is on the person, not the seat.
    await expect(canvas.getByText('Vocals')).toBeVisible();
    await expect(canvas.getByText('Guitar')).toBeVisible();

    // #1039's preprod regression: this band plays BOTH sets, so each of Sam's parts is called
    // twice and says so. It previously showed one bare "18:00" — the earliest of the two — which
    // left the reader with no sign the evening call existed at all.
    // Four rows carry the pair, not two: Sam's two parts under Players, and the band's two vacant
    // parts under Parts to fill — the same PartRow, which is the point of it being one component.
    await expect(canvas.getAllByText('18:00 Drinks Reception')).toHaveLength(4);
    await expect(canvas.getAllByText('20:30 Evening Party')).toHaveLength(4);
  },
};

// ── 9 ─────────────────────────────────────────────────────────────────────────
export const SetFee: Story = {
  name: '9. The session fee is on the person — + Add fee opens, commits, and cancels cleanly',
  args: {
    lineups: [{ id: 'lu-1', label: 'My four-piece', packageIds: [DRINKS] }],
    chairs: fourPieceChairs('lu-1', ['m-ana', null, null, null], [DRINKS_CALL]),
    members: [ana],
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Add fee for Ana Reis' });
    await userEvent.click(trigger);

    await userEvent.type(canvas.getByRole('spinbutton', { name: 'fee for Ana Reis amount' }), '180');
    await userEvent.click(canvas.getByRole('button', { name: 'Save fee for Ana Reis' }));
    await expect(args.onSaveMemberFee).toHaveBeenCalledWith('m-ana', 180);

    // Cancel restores the trigger unchanged (the story's props never change, so it reads as "add").
    await userEvent.click(canvas.getByRole('button', { name: 'Add fee for Ana Reis' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel fee for Ana Reis' }));
    await expect(canvas.getByRole('button', { name: 'Add fee for Ana Reis' })).toBeVisible();
  },
};

// ── 10 ────────────────────────────────────────────────────────────────────────
export const FillAPart: Story = {
  name: '10. Filling a vacant part hands the chair id and the contact id up',
  args: {
    lineups: [{ id: 'lu-1', label: 'My four-piece', packageIds: [DRINKS] }],
    chairs: fourPieceChairs('lu-1', undefined, [DRINKS_CALL]),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('4 parts · 4 still to fill')).toBeVisible();
    // A filled part and an empty one are the SAME row — one component used twice.
    await expect(canvas.getAllByRole('combobox', { name: 'Fill this part…' })).toHaveLength(4);
  },
};

// ── 11 ─── JOURNEY ④ ─────────────────────────────────────────────────────────
export const LineupLosesASegment: Story = {
  name: '11. Journey ④ — taking a set off a band names who is affected and what survives',
  args: {
    lineups: [{ id: 'lu-1', label: 'My four-piece', packageIds: [DRINKS, EVENING] }],
    chairs: fourPieceChairs('lu-1', ['m-sam', 'm-ana', null, null]),
    members: [sam, ana],
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Actions' }));
    await userEvent.click(await screen.findByText('What they play…'));

    const dialog = within(await screen.findByRole('dialog'));
    await expect(dialog.getByText('Currently plays Drinks Reception and Evening Party.')).toBeVisible();

    // Untick the drinks set.
    await userEvent.click(dialog.getByRole('button', { name: /Drinks Reception/ }));

    // The warning is the point: it names the affected players and states what survives, so the
    // safe operation does not look like the destructive one.
    await expect(dialog.getByText('My four-piece will no longer play Drinks Reception.')).toBeVisible();
    await expect(
      dialog.getByText(/Sam Okonkwo, Ana Reis keep their part in Evening Party, along with their invitation and confirmation\./),
    ).toBeVisible();

    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await expect(args.onSetLineupSegments).toHaveBeenCalledWith('lu-1', [EVENING]);
  },
};

// ── Regression cover, found in review ────────────────────────────────────────

// Applying a lineup DELETES the band it displaces, with its parts and their confirmations. The
// segment selection defaults to every set, so the default choice on a booking that already has a
// band is the destructive one — and it warned about nothing. Journey ④, which destroys nothing,
// warned prominently; the safe operation shouted and the destructive one was silent.
export const ApplyWouldSweepAnExistingBand: Story = {
  name: 'Adding a lineup over a band that already plays those sets says whose seats it takes',
  args: {
    lineups: [{ id: 'lu-1', label: 'My four-piece', packageIds: [DRINKS, EVENING] }],
    chairs: fourPieceChairs('lu-1', ['m-sam', 'm-ana', null, null]),
    members: [sam, ana],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Add a lineup' }));

    const dialog = within(await screen.findByRole('dialog'));
    // Both sets are selected by default, so the four-piece would be swept.
    await expect(dialog.getByText('This replaces My four-piece.')).toBeVisible();
    await expect(
      dialog.getByText(/Sam Okonkwo, Ana Reis lose their parts and their confirmation\./),
    ).toBeVisible();

    // Untick one set and the four-piece survives — so the warning goes.
    await userEvent.click(dialog.getByRole('button', { name: /Evening Party/ }));
    await expect(dialog.queryByText('This replaces My four-piece.')).not.toBeInTheDocument();
  },
};

// A member holding no parts is not a player. Emptying someone's last part used to drop them from
// this card while leaving them on the Info tab as an unlabelled chip, with no way to clear them
// (#987 removed the per-person remove). One rule, `rendersAsPlayer`, now governs both surfaces.
export const MemberWithNoPartsIsNotAPlayer: Story = {
  name: 'Someone holding no parts does not render as a player — unless they are you',
  args: {
    lineups: [{ id: 'lu-1', label: 'My four-piece', packageIds: [DRINKS] }],
    chairs: fourPieceChairs('lu-1', ['m-sam', null, null, null], [DRINKS_CALL]),
    members: [sam, ana],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Sam Okonkwo')).toBeVisible();
    await expect(canvas.queryByText('Ana Reis')).not.toBeInTheDocument();
  },
};
