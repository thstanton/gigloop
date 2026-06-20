import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { Clock, Info, MapPin, ClipboardList } from 'lucide-react';
import { AddToTheDayCard } from './AddToTheDayCard';

const meta = {
  component: AddToTheDayCard,
  parameters: { viewport: { defaultViewport: 'mobile1' } },
} satisfies Meta<typeof AddToTheDayCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllMissing: Story = {
  args: {
    concerns: [
      { icon: <Clock size={16} />, label: 'Itinerary', actionLabel: 'Add', onAction: fn() },
      { icon: <Info size={16} />, label: 'Details', actionLabel: 'Add', onAction: fn() },
      { icon: <MapPin size={16} />, label: 'Venue', actionLabel: 'Add', onAction: fn() },
      { icon: <ClipboardList size={16} />, label: 'Music form', actionLabel: 'Set up', onAction: fn() },
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Add to the day')).toBeVisible();
    await expect(canvas.getByText('Itinerary')).toBeVisible();
    await expect(canvas.getByText('Details')).toBeVisible();
    await expect(canvas.getByText('Venue')).toBeVisible();
    await expect(canvas.getByText('Music form')).toBeVisible();
  },
};

export const SomeMissing: Story = {
  args: {
    concerns: [
      { icon: <MapPin size={16} />, label: 'Venue', actionLabel: 'Add', onAction: fn() },
      { icon: <ClipboardList size={16} />, label: 'Music form', actionLabel: 'Set up', onAction: fn() },
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Add to the day')).toBeVisible();
    await expect(canvas.getByText('Venue')).toBeVisible();
    await expect(canvas.getByText('Music form')).toBeVisible();
    await expect(canvas.queryByText('Itinerary')).toBeNull();
    await expect(canvas.queryByText('Details')).toBeNull();
  },
};

export const ActionRoutes: Story = {
  args: {
    concerns: [
      { icon: <MapPin size={16} />, label: 'Venue', actionLabel: 'Add', onAction: fn() },
      { icon: <ClipboardList size={16} />, label: 'Music form', actionLabel: 'Set up', onAction: fn() },
    ],
  },
  play: async ({ canvas, args }) => {
    const [venueConcern, musicConcern] = args.concerns;
    await userEvent.click(canvas.getAllByRole('button', { name: 'Add' })[0]);
    await expect(venueConcern.onAction).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole('button', { name: 'Set up' }));
    await expect(musicConcern.onAction).toHaveBeenCalledTimes(1);
  },
};

export const Empty: Story = {
  args: { concerns: [] },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText('Add to the day')).toBeNull();
  },
};
