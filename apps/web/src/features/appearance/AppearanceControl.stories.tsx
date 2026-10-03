import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { AppearanceControl } from './AppearanceControl';
import type { AppearancePreference } from '@/lib/constants';

// The musician's System / Light / Dark control (ADR-0085 §3, #1079). Presentational: value and
// onChange only. View each story in both toolbar appearances (Light / Dark) to check the pills.
function Harness({ initial }: Readonly<{ initial: AppearancePreference }>) {
  const [value, setValue] = useState<AppearancePreference>(initial);
  return (
    <div className="max-w-xs bg-background p-4">
      <AppearanceControl value={value} onChange={setValue} />
    </div>
  );
}

const meta: Meta<typeof AppearanceControl> = {
  component: AppearanceControl,
  tags: ['ai-generated'],
};

export default meta;
type Story = StoryObj<typeof AppearanceControl>;

export const System: Story = {
  render: () => <Harness initial="system" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('radiogroup', { name: 'Appearance' })).toBeVisible();
    await expect(canvas.getAllByRole('radio')).toHaveLength(3);
    await expect(canvas.getByRole('radio', { name: 'System' })).toBeChecked();
  },
};

export const Light: Story = {
  render: () => <Harness initial="light" />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('radio', { name: 'Light' })).toBeChecked();
  },
};

export const Dark: Story = {
  render: () => <Harness initial="dark" />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('radio', { name: 'Dark' })).toBeChecked();
  },
};

export const ChangesSelection: Story = {
  name: 'Clicking an option selects it',
  render: () => <Harness initial="system" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('radio', { name: 'Dark' }));
    await expect(canvas.getByRole('radio', { name: 'Dark' })).toBeChecked();
    await expect(canvas.getByRole('radio', { name: 'System' })).not.toBeChecked();
  },
};
