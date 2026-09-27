import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { X } from 'lucide-react';
import { IconButton } from '@/components/common/IconButton';
import { PartRow } from './PartRow';

// #983's part shape, used for a part and nothing else — and used IDENTICALLY under a player and in
// `Parts to fill`. These stories pin the two decisions it carries: the narrower LabelValue column
// (a className override on the primitive, not a copy of its styling), and the rule that a part row
// names its band only when the booking has more than one.

const meta = {
  component: PartRow,
  tags: ['ai-generated'],
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  args: {
    role: 'Bass',
    callTimes: ['18:00 Drinks Reception'],
  },
} satisfies Meta<typeof PartRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'One band on the booking — no band name on the row',
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Bass')).toBeVisible();
    await expect(canvas.getByText('18:00 Drinks Reception')).toBeVisible();
  },
};

// The row this component exists for: a part plays every segment its band plays, so a band on two
// of them is called twice and the row says so. Collapsing that to the earliest time was the #1039
// preprod regression — the second call vanished with no sign it existed.
export const CalledToTwoSegments: Story = {
  name: 'A part called to two segments shows a time for each, one per line',
  args: { callTimes: ['18:00 Drinks Reception', '20:30 Evening Party'] },
  play: async ({ canvas }) => {
    const drinks = canvas.getByText('18:00 Drinks Reception');
    const evening = canvas.getByText('20:30 Evening Party');
    await expect(drinks).toBeVisible();
    await expect(evening).toBeVisible();

    // The two calls must be on their OWN LINES, not run together inline. Asserted on the layout
    // rather than the text because both renderings produce these same two text nodes — the
    // earlier inline version kept every getByText assertion above green, which is precisely how
    // #1039 shipped a call time the design never asked for. Two calls are two separate facts
    // about the day: the player has to be somewhere twice.
    //
    // On the class, not the computed style: no stylesheet is loaded here, so `getComputedStyle`
    // reports nothing at all. Same reason ContractCard and ProgressIndicator assert theirs.
    await expect(drinks.parentElement).toBe(evening.parentElement);
    await expect(drinks.parentElement).toHaveClass('flex-col');
  },
};

// The package-less bucket on a booking with no packages: `callTimeParts` names it rather than
// leaving a bare time with nothing to say what it is a call for.
export const WholeGig: Story = {
  name: 'A booking with no packages — the one call reads "Whole gig"',
  args: { callTimes: ['18:00 Whole gig'] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('18:00 Whole gig')).toBeVisible();
  },
};

export const NamesItsBand: Story = {
  name: 'Two bands on the booking — the row names which one this part belongs to',
  args: { bandName: 'My four-piece' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('My four-piece')).toBeVisible();
  },
};

export const NoCallTime: Story = {
  name: 'No timed set behind it — absent, not zero',
  args: { callTimes: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('No call time')).toBeVisible();
  },
};

export const WithAction: Story = {
  name: 'The row carries exactly one action',
  args: {
    action: (
      <IconButton label="Empty the Bass part" onClick={fn()}>
        <X size={14} />
      </IconButton>
    ),
  },
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: 'Empty the Bass part' });
    await userEvent.click(button);
    await expect(button).toBeVisible();
  },
};
