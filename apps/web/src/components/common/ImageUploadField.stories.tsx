import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';
import { ImageUploadField } from './ImageUploadField';

const meta = {
  title: 'Common/ImageUploadField',
  component: ImageUploadField,
  tags: ['autodocs'],
  args: {
    label: 'Logo',
    description: 'Used on invoices and your client portal.',
    currentUrl: null,
    uploading: false,
    removing: false,
    onFileSelect: () => {},
    onRemove: () => {},
  },
} satisfies Meta<typeof ImageUploadField>;

export default meta;
type Story = StoryObj<typeof meta>;

// Smoke — with no current image the placeholder icon and a single "Upload" button render.
export const Empty: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Logo')).toBeVisible();
    await expect(canvas.getByRole('button', { name: /Upload/ })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: /Remove/ })).toBeNull();
  },
};

// With an image, the button reads "Change" and a "Remove" button appears.
export const WithImage: Story = {
  args: { currentUrl: 'https://placehold.co/128x48/png' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: /Change/ })).toBeVisible();
    await expect(canvas.getByRole('button', { name: /Remove/ })).toBeVisible();
  },
};

// Primary use case — selecting a file below the size limit invokes onFileSelect with it.
export const SelectsFile: Story = {
  render: (args) => {
    const [picked, setPicked] = useState<string | null>(null);
    return (
      <div className="space-y-2">
        <ImageUploadField {...args} onFileSelect={(file) => setPicked(file.name)} />
        <p data-testid="picked">{picked ?? 'none'}</p>
      </div>
    );
  },
  play: async ({ canvas, canvasElement }) => {
    const file = new File(['x'], 'band-logo.png', { type: 'image/png' });
    // The file input is visually hidden (sr-only) but present in the DOM.
    const input = canvasElement.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, file);
    await expect(canvas.getByTestId('picked')).toHaveTextContent('band-logo.png');
  },
};
