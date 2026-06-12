import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import { UploadDocumentSheet } from './UploadDocumentSheet';

const meta = {
  component: UploadDocumentSheet,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
  args: {
    bookingId: 'bd1',
    open: true,
    onOpenChange: () => {},
  },
} satisfies Meta<typeof UploadDocumentSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OpenEmpty: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.findByLabelText('Document name')).resolves.toBeVisible();
    await expect(canvas.findByLabelText('PDF file')).resolves.toBeVisible();
  },
};
