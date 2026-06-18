import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { DateBadge } from './DateBadge';

const meta: Meta<typeof DateBadge> = {
  title: 'Common/DateBadge',
  component: DateBadge,
  tags: ['autodocs'],
  args: { date: '2026-06-18' },
};

export default meta;
type Story = StoryObj<typeof DateBadge>;

export const Small: Story = { args: { size: 'sm' } };
export const Medium: Story = { args: { size: 'md' } };
export const Large: Story = { args: { size: 'lg' } };

export const AllSizes: Story = {
  render: (args) => (
    <div className="flex items-end gap-6">
      <DateBadge {...args} size="sm" />
      <DateBadge {...args} size="md" />
      <DateBadge {...args} size="lg" />
    </div>
  ),
};

/** Primary use case: shows day + month, weekday on lg, and a full a11y label. */
export const PrimaryUseCase: Story = {
  args: { size: 'lg' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Day number and short month are always present.
    await expect(canvas.getByText('18')).toBeInTheDocument();
    await expect(canvas.getByText('Jun')).toBeInTheDocument();
    // Weekday renders at lg.
    await expect(canvas.getByText('Thu')).toBeInTheDocument();
    // Full, human-readable date is exposed to assistive tech.
    await expect(canvas.getByLabelText('Thursday, 18 June 2026')).toBeInTheDocument();
  },
};
