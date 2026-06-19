import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import { IconPicker } from './IconPicker';
import { PACKAGE_ICON_OPTIONS } from '@/lib/constants';

const meta: Meta<typeof IconPicker> = {
  title: 'Common/IconPicker',
  component: IconPicker,
  tags: ['autodocs'],
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return <IconPicker {...args} value={value} onChange={setValue} />;
  },
};

export default meta;
type Story = StoryObj<typeof IconPicker>;

export const Default: Story = {
  args: { value: PACKAGE_ICON_OPTIONS[0], label: 'Icon' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The Icon label and the grid of options render.
    await expect(canvas.getByText('Icon')).toBeVisible();
    // Selecting a different icon highlights it (primary border).
    const target = PACKAGE_ICON_OPTIONS[1];
    const button = canvas.getByRole('button', { name: target });
    await userEvent.click(button);
    await expect(button).toHaveClass('border-primary');
  },
};

export const NoLabel: Story = {
  args: { value: PACKAGE_ICON_OPTIONS[0], label: null },
};
