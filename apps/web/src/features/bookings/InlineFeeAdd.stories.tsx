import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';
import InlineFeeAdd from './InlineFeeAdd';

const meta = {
  component: InlineFeeAdd,
  tags: ['ai-generated'],
  args: {
    onSave: () => {},
    isSaving: false,
  },
} satisfies Meta<typeof InlineFeeAdd>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('+ Add fee')).toBeVisible();
  },
};

export const EditingMode: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByText('+ Add fee'));
    await expect(canvas.getByPlaceholderText('0.00')).toBeVisible();
  },
};

export const Saving: Story = {
  args: { isSaving: true },
};
