import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import CustomiseSheet, { type Overrides } from './CustomiseSheet';

const defaultOverrides: Overrides = {
  theme: 'LIGHT_MODERN',
  brandColour: '#1a1a1a',
  heroImage: null,
  showContactPhoto: false,
  showContactEmail: true,
  showContactPhone: false,
};

function StatefulSheet(props: Partial<React.ComponentProps<typeof CustomiseSheet>>) {
  const [overrides, setOverrides] = useState<Overrides>(defaultOverrides);
  const [open, setOpen] = useState(true);
  const [isDirty, setIsDirty] = useState(false);

  function handleChange(next: Partial<Overrides>) {
    setOverrides((prev) => ({ ...prev, ...next }));
    setIsDirty(true);
  }

  return (
    <CustomiseSheet
      open={open}
      onOpenChange={setOpen}
      overrides={overrides}
      onChange={handleChange}
      onSave={() => setIsDirty(false)}
      isDirty={isDirty}
      isSaving={false}
      hasPhoto={true}
      hasEmail={true}
      hasPhone={true}
      {...props}
    />
  );
}

const meta = {
  component: StatefulSheet,
  tags: ['ai-generated'],
} satisfies Meta<typeof StatefulSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await expect(canvas.getByText('Customise portal')).toBeVisible();
    await expect(canvas.getByText('Theme')).toBeVisible();
    await expect(canvas.getByText('Brand colour')).toBeVisible();
    await expect(canvas.getByText('Contact card')).toBeVisible();
  },
};

export const BoldModernTheme: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByText('Bold Modern'));
    await expect(canvas.getByText('Hero image')).toBeVisible();
  },
};

export const BoldRomanticTheme: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByText('Bold Romantic'));
    await expect(canvas.getByText('Hero image')).toBeVisible();
  },
};

export const LightRomanticTheme: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByText('Light Romantic'));
    await expect(canvas.queryByText('Hero image')).toBeNull();
  },
};

export const BrandColourChange: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    // getByRole('textbox') targets the hex text input specifically,
    // not the adjacent <input type="color"> which shares the same value
    const hexInput = canvas.getByRole('textbox');
    await expect(hexInput).toHaveValue('#1a1a1a');
    // The hex input is a controlled React input with maxLength=7 and regex validation,
    // so we step through valid intermediate values by backspacing 6 hex chars then typing new ones
    await userEvent.type(hexInput, '{backspace}{backspace}{backspace}{backspace}{backspace}{backspace}ff5500');
    const saveBtn = canvas.getByRole('button', { name: /save changes/i });
    await expect(saveBtn).not.toBeDisabled();
  },
};

export const NoContactDetails: Story = {
  args: { hasPhoto: false, hasEmail: false, hasPhone: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await expect(canvas.getByText('Add contact details in Settings to configure visibility.')).toBeVisible();
  },
};

export const Saving: Story = {
  args: { isSaving: true, isDirty: true },
};
