import type { Meta, StoryObj } from '@storybook/react';
import { SectionHeader } from './SectionHeader';

const meta: Meta<typeof SectionHeader> = {
  title: 'Common/SectionHeader',
  component: SectionHeader,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SectionHeader>;

export const LabelOnly: Story = {
  args: { label: 'People' },
};

export const LabelAndAction: Story = {
  args: {
    label: 'Songs',
    action: (
      <button className="text-xs text-primary hover:text-primary/80 transition-colors">
        + Add song
      </button>
    ),
  },
};
