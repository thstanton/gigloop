import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';
import { PackageForm, emptyPackageFormValues, type PackageFormValues } from './PackageForm';

// PackageForm is fully controlled; this harness supplies the owning state a container provides.
function Harness({ initial }: { initial?: PackageFormValues }) {
  const [value, setValue] = useState<PackageFormValues>(initial ?? emptyPackageFormValues());
  return <PackageForm value={value} onChange={(patch) => setValue((v) => ({ ...v, ...patch }))} />;
}

const meta = {
  component: PackageForm,
  tags: ['ai-generated'],
  // Stories drive their own state via <Harness>; these args satisfy the required props.
  args: { value: emptyPackageFormValues(), onChange: () => {} },
} satisfies Meta<typeof PackageForm>;

export default meta;
type Story = StoryObj<typeof meta>;

// Smoke — the form's fields render, and the field is labelled "Special requests" (not the old
// "Key moments"), which is the one copy change this extraction makes.
export const Default: Story = {
  render: () => <Harness />,
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Label')).toBeVisible();
    await expect(canvas.getByText('Special requests')).toBeVisible();
    await expect(canvas.getByText('Sets')).toBeVisible();
    await expect(canvas.queryByText('Key moments')).toBeNull();
  },
};

// Primary use case — fill the label and add a special request.
export const Editing: Story = {
  render: () => <Harness />,
  play: async ({ canvas }) => {
    const label = canvas.getByPlaceholderText('Package name');
    await userEvent.type(label, 'Jazz Trio');
    await expect(label).toHaveValue('Jazz Trio');

    // The first "Type and press Enter" input is the Special requests tag input.
    const tagInput = canvas.getAllByPlaceholderText('Type and press Enter')[0];
    await userEvent.type(tagInput, 'First dance{enter}');
    await expect(canvas.getByText('First dance')).toBeVisible();
  },
};
