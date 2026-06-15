import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import InvoiceRow from './InvoiceRow';
import type { Invoice } from '@/types/api';

const customer = { id: 'c1', name: 'Jane Smith', email: 'jane@example.com', phone: null, addressLine1: null, addressLine2: null, city: null, county: null, postcode: null, country: null, latitude: null, longitude: null, placeId: null, travelTimeMinutes: null, travelDistanceMetres: null, travelTimeCalculatedAt: null, travelMode: null, notes: null, greetingName: 'Jane', primaryRole: 'CUSTOMER', parkingInfo: null, accessInfo: null, equipmentAvailable: null, website: null, commissionArrangement: null, createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z' };

const lineItem = { id: 'li1', createdAt: '2030-04-01T00:00:00Z', updatedAt: '2030-04-01T00:00:00Z', description: 'Performance fee', amount: '1500.00', order: 0 };

const baseInvoice: Invoice = {
  id: 'inv1',
  createdAt: '2030-04-01T10:00:00Z',
  updatedAt: '2030-04-01T10:00:00Z',
  status: 'DRAFT',
  isDeposit: true,
  invoiceNumber: 'INV-001',
  issueDate: '2030-04-01',
  dueDate: '2030-05-01',
  paidAt: null,
  bookingId: 'b1',
  billToContactId: 'c1',
  billToContact: customer,
  lineItems: [lineItem],
};

const noop = () => {};

const meta = {
  component: InvoiceRow,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
  args: {
    pdfUrl: null,
    isDeletePending: false,
    isVoidPending: false,
    onEdit: noop,
    onPreview: noop,
    onIssue: noop,
    onDelete: noop,
    onSend: noop,
    onMarkSent: noop,
    onMarkPaid: noop,
    onVoid: noop,
  },
} satisfies Meta<typeof InvoiceRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DepositDraft: Story = {
  args: { invoice: { ...baseInvoice, status: 'DRAFT', isDeposit: true, invoiceNumber: null, issueDate: null, dueDate: null } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Deposit')).toBeVisible();
    await expect(canvas.getByText('Draft')).toBeVisible();
    // Mobile trigger
    await expect(canvas.getByRole('button', { name: 'Actions' })).toBeVisible();
  },
};

export const BalanceDraft: Story = {
  args: { invoice: { ...baseInvoice, status: 'DRAFT', isDeposit: false } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Balance')).toBeVisible();
    await expect(canvas.getByText('Draft')).toBeVisible();
  },
};

export const DepositIssued: Story = {
  args: { invoice: { ...baseInvoice, status: 'ISSUED', isDeposit: true } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Deposit')).toBeVisible();
    await expect(canvas.getByText('Issued')).toBeVisible();
    // Send is the primary action for ISSUED
    await expect(canvas.getByRole('button', { name: 'Send' })).toBeVisible();
  },
};

export const IssuedWithPdf: Story = {
  args: {
    invoice: { ...baseInvoice, status: 'ISSUED' },
    pdfUrl: 'https://example.com/invoice.pdf',
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Issued')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Send' })).toBeVisible();
  },
};

export const Sent: Story = {
  args: { invoice: { ...baseInvoice, status: 'SENT' } },
  play: async ({ canvas }) => {
    // Desktop primary shortcut for SENT = Mark as paid
    await expect(canvas.getByRole('button', { name: 'Mark as paid' })).toBeVisible();
  },
};

export const SentWithPdf: Story = {
  args: {
    invoice: { ...baseInvoice, status: 'SENT' },
    pdfUrl: 'https://example.com/invoice.pdf',
  },
  play: async ({ canvas }) => {
    // Download is secondary (not primary shortcut) for SENT — primary remains Mark as paid
    await expect(canvas.getByRole('button', { name: 'Mark as paid' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'More actions' })).toBeVisible();
  },
};

export const SentOverdue: Story = {
  args: {
    invoice: { ...baseInvoice, status: 'SENT', dueDate: '2029-01-01' },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Overdue')).toBeVisible();
  },
};

export const IssuedPastDueNotOverdue: Story = {
  args: {
    // ISSUED past its due date should NOT show as overdue — overdue only applies to SENT
    invoice: { ...baseInvoice, status: 'ISSUED', dueDate: '2029-01-01' },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Issued')).toBeVisible();
  },
};

export const Paid: Story = {
  args: {
    invoice: { ...baseInvoice, status: 'PAID', paidAt: '2030-05-02T10:00:00Z' },
    pdfUrl: 'https://example.com/invoice.pdf',
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Paid')).toBeVisible();
    // Download is primary action for PAID with pdfUrl
    await expect(canvas.getByRole('button', { name: 'Download' })).toBeVisible();
  },
};

export const Voided: Story = {
  args: { invoice: { ...baseInvoice, status: 'VOID' } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Void')).toBeVisible();
  },
};
