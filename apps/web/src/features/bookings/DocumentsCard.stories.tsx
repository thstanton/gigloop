import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { DocumentsCard } from './DocumentsCard';

const contractDoc = {
  id: 'd1',
  createdAt: '2030-04-02T10:00:00Z',
  type: 'CONTRACT',
  url: 'https://example.com/contract.pdf',
  invoiceId: null,
  contractStatus: 'SIGNED',
  portalVisibility: { visible: true },
};

const voidContractDoc = {
  id: 'd2',
  createdAt: '2030-04-03T10:00:00Z',
  type: 'CONTRACT',
  url: 'https://example.com/contract-void.pdf',
  invoiceId: null,
  contractStatus: 'VOID',
  portalVisibility: { visible: false, reason: 'voided' },
};

const depositInvoice = {
  id: 'inv1',
  createdAt: '2030-04-04T10:00:00Z',
  updatedAt: '2030-04-04T10:00:00Z',
  isDeposit: true,
  status: 'PAID',
  amount: '600.00',
  invoiceNumber: 'INV-2030-001',
  sentAt: null,
  paidAt: '2030-04-10T10:00:00Z',
  dueDate: null,
  bookingId: 'bd1',
};

const invoiceDoc = {
  id: 'd3',
  createdAt: '2030-04-04T10:00:00Z',
  type: 'INVOICE',
  url: 'https://example.com/invoice.pdf',
  invoiceId: 'inv1',
  contractStatus: null,
  name: null,
  portalVisibility: { visible: true },
};

const uploadDoc = {
  id: 'd4',
  createdAt: '2030-04-05T10:00:00Z',
  type: 'UPLOAD',
  url: 'https://example.com/upload.pdf',
  invoiceId: null,
  contractStatus: null,
  name: 'O2 Academy Contract',
  portalVisibility: { visible: false, reason: 'not_shared' },
};

const meta = {
  component: DocumentsCard,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
  args: { bookingId: 'bd1' },
  parameters: {
    msw: {
      handlers: [
        http.get('/api/bookings/bd1/documents', () => HttpResponse.json([contractDoc, invoiceDoc])),
        http.get('/api/bookings/bd1/invoices', () => HttpResponse.json([depositInvoice])),
        http.get('https://example.com/:file', () => new HttpResponse(null, { status: 200 })),
      ],
    },
  },
} satisfies Meta<typeof DocumentsCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithDocuments: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.findByText('Contract')).resolves.toBeVisible();
    await expect(canvas.findByText('Deposit invoice')).resolves.toBeVisible();
    await expect(canvas.findByText('INV-2030-001')).resolves.toBeVisible();
    // Each row carries its own portal-visibility indicator (ADR-0054 / #580).
    const visibleBadges = await canvas.findAllByText('Visible on Client Portal');
    await expect(visibleBadges).toHaveLength(2);
  },
};

export const Empty: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/bookings/bd1/documents', () => HttpResponse.json([])),
        http.get('/api/bookings/bd1/invoices', () => HttpResponse.json([])),
      ],
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.findByText('No documents yet')).resolves.toBeVisible();
  },
};

export const VoidContract: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/bookings/bd1/documents', () => HttpResponse.json([voidContractDoc])),
        http.get('/api/bookings/bd1/invoices', () => HttpResponse.json([])),
      ],
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.findByText('Contract [VOID]')).resolves.toBeVisible();
  },
};

export const WithUploadDocument: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/bookings/bd1/documents', () => HttpResponse.json([contractDoc, uploadDoc])),
        http.get('/api/bookings/bd1/invoices', () => HttpResponse.json([])),
      ],
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.findByText('O2 Academy Contract')).resolves.toBeVisible();
    // The UPLOAD row reads the private-paperwork hint, never a visible badge.
    await expect(canvas.findByText('Not visible to client')).resolves.toBeVisible();
  },
};

export const DownloadClick: Story = {
  play: async ({ canvas }) => {
    const buttons = await canvas.findAllByRole('button', { name: 'Download' });
    await userEvent.click(buttons[0]);
  },
};
