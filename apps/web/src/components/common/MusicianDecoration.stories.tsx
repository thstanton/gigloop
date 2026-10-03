import type { Meta, StoryObj } from '@storybook/react';
import { expect } from 'storybook/test';
import { MusicianDecoration } from './MusicianDecoration';
import {
  MUSICIAN_FIGURE_DARK,
  MUSICIAN_FIGURE_DESCRIPTIONS,
  MUSICIAN_FIGURE_ORDER,
  MUSICIAN_TAILPIECE_PX,
} from '@/lib/constants';

// The figures are printed on warm parchment, never white — judging them on a white
// canvas is the one way to be sure the crop and the ink are wrong.
const meta: Meta<typeof MusicianDecoration> = {
  title: 'Common/MusicianDecoration',
  component: MusicianDecoration,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="bg-background p-8">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof MusicianDecoration>;

/** The tier in use: the stage-advance dialog's tailpiece. */
export const Tailpiece: Story = {
  play: async ({ canvasElement }) => {
    const figure = canvasElement.querySelector('img');
    await expect(figure).toBeInTheDocument();
    // Decoration, not information — assistive tech must skip it entirely.
    await expect(figure).toHaveAttribute('alt', '');
    await expect(figure).toHaveAttribute('aria-hidden');
  },
};

/**
 * Every figure in the pool, at the tailpiece size. Because selection is random, any
 * figure can land in the slot — so they have to hold up interchangeably here.
 */
export const EveryFigure: Story = {
  render: () => (
    <div className="flex flex-wrap items-end gap-8">
      {MUSICIAN_FIGURE_ORDER.map((figure) => (
        <figure key={figure} className="text-center">
          <MusicianDecoration figure={figure} />
          <figcaption className="mt-2 text-muted text-sm">{MUSICIAN_FIGURE_DESCRIPTIONS[figure]} · dark: {MUSICIAN_FIGURE_DARK[figure]}</figcaption>
        </figure>
      ))}
    </div>
  ),
};

/**
 * The size review surface. The grill left the exact value to be judged by eye against
 * real parchment rather than guessed. MUSICIAN_TAILPIECE_PX is the current default.
 */
export const SizeCandidates: Story = {
  render: () => (
    <div className="flex flex-wrap items-end gap-8">
      {[64, 80, MUSICIAN_TAILPIECE_PX, 128, 160].map((size) => (
        <figure key={size} className="text-center">
          <MusicianDecoration figure={MUSICIAN_FIGURE_ORDER[0]} size={size} />
          <figcaption className="mt-2 text-muted text-sm">{size}px</figcaption>
        </figure>
      ))}
    </div>
  ),
};
