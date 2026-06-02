import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Check, Music } from 'lucide-react';
import { TogglePill } from './toggle-pill';

const meta: Meta<typeof TogglePill> = {
  title: 'UI/TogglePill',
  component: TogglePill,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Inactive: Story = {
  args: { active: false, children: 'None' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'None' })).toBeVisible();
  },
};

export const Active: Story = {
  args: { active: true, children: 'Confirmed' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Confirmed' })).toBeVisible();
  },
};

export const WithIcon: Story = {
  args: {
    active: true,
    children: (
      <>
        <Music size={14} />
        Duo
        <Check size={12} />
      </>
    ),
  },
};

export const Group: Story = {
  render: () => (
    <div className="flex gap-2">
      <TogglePill active={false} onClick={() => {}}>None</TogglePill>
      <TogglePill active={true} onClick={() => {}}>Existing series</TogglePill>
      <TogglePill active={false} onClick={() => {}}>New series</TogglePill>
    </div>
  ),
};
