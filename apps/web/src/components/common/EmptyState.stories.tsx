import type { Meta, StoryObj } from '@storybook/react';
import { Music } from 'lucide-react';
import { EmptyState } from './EmptyState';

const meta: Meta<typeof EmptyState> = {
  title: 'Common/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const HeadingOnly: Story = {
  args: {
    icon: <Music size={40} strokeWidth={1.5} />,
    heading: 'No songs yet',
  },
};

export const HeadingAndDescription: Story = {
  args: {
    icon: <Music size={40} strokeWidth={1.5} />,
    heading: 'No songs yet',
    description: 'Add songs to your repertoire to include them in bookings.',
  },
};

export const HeadingDescriptionAndCTA: Story = {
  args: {
    icon: <Music size={40} strokeWidth={1.5} />,
    heading: 'No songs yet',
    description: 'Add songs to your repertoire to include them in bookings.',
    action: (
      <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
        Add song
      </button>
    ),
  },
};
