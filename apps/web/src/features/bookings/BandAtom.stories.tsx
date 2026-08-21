import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, screen, userEvent, within } from 'storybook/test';
import { BandAtom } from './BandAtom';
import { lineupTemplate } from '@/test/factories';
import type { BookingBandChair, BookingPackageSummary } from '@/types/api';

// The Band atom is presentational: it owns no mutation and no fetch. The host (BandSheet) passes
// the chairs/packages/lineup templates and signals every edit via a callback. This slice's Band
// sheet renders the unfilled-chair block only — every chair here is vacant (#884).

const packages: BookingPackageSummary[] = [{ id: 'pkg-evening', order: 1, label: 'Evening', icon: 'guitar' }];

const chairs: BookingBandChair[] = [
  { id: 'ch1', role: 'Saxophone', order: 1, packageId: 'pkg-evening', memberId: null, callTime: '19:30' },
  { id: 'ch2', role: 'Drums', order: 2, packageId: null, memberId: null, callTime: null },
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
    chairs,
    packages,
    lineupTemplates: lineups,
    lineupTemplatesLoading: false,
    onApplyLineup: fn(),
    isApplyingLineup: false,
    onAddChair: fn(),
    isAddingChair: false,
    onRemoveChair: fn(),
    removingChairId: null,
    onMoveChair: fn(),
  },
} satisfies Meta<typeof BandAtom>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithChairs: Story = {
  name: 'Chairs to fill, with a call time derived on one and absent on the package-less one',
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
