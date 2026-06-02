import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import InvoiceSection from './InvoiceSection';
import type { Invoice } from '@/types/api';

const customer = { id: 'c1', name: 'Jane Smith', email: 'jane@example.com', phone: null, addressLine1: null, addressLine2: null, city: null, county: null, postcode: null, country: null, latitude: null, longitude: null, placeId: null, travelTimeMinutes: null, travelDistanceMetres: null, travelTimeCalculatedAt: null, travelMode: null, notes: null, greetingName: 'Jane', primaryRole: 'CUSTOMER', parkingInfo: null, accessInfo: null, equipmentAvailable: null, website: null, commissionArrangement: null, createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z' };
const lineItem = { id: 'li1', createdAt: '2030-04-01T00:00:00Z', updatedAt: '2030-04-01T00:00:00Z', description: 'Performance fee', amount: '1500.00', order: 0 };

const depositDraft: Invoice = {
  id: 'inv1', createdAt: '2030-04-01T10:00:00Z', updatedAt: '2030-04-01T10:00:00Z',
  status: 'DRAFT', isDeposit: true, invoiceNumber: 'INV-001',
  issueDate: '2030-04-01', dueDate: '2030-05-01', paidAt: null,
  bookingId: 'b1', billToContactId: 'c1', billToContact: customer,
  lineItems: [{ ...lineItem, amount: '600.00' }],
};

const depositSent: Invoice = { ...depositDraft, id: 'inv2', status: 'SENT', invoiceNumber: 'INV-002', dueDate: '2030-07-01' };
const balanceDraft: Invoice = { ...depositDraft, id: 'inv3', status: 'DRAFT', isDeposit: false, invoiceNumber: 'INV-003', lineItems: [{ ...lineItem, amount: '1400.00' }] };
const depositPaid: Invoice = { ...depositDraft, id: 'inv4', status: 'PAID', paidAt: '2030-05-02T10:00:00Z' };
const balancePaid: Invoice = { ...balanceDraft, id: 'inv5', status: 'PAID', paidAt: '2030-07-10T10:00:00Z' };

const noop = () => {};

const meta = {
  component: InvoiceSection,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
  args: {
    documents: [],
    isPending: false,
    onNewDepositInvoice: noop,
    onNewBalanceInvoice: noop,
    onEdit: noop,
    onDelete: noop,
    onSend: noop,
    onMarkSent: noop,
    onMarkPaid: noop,
    onVoid: noop,
  },
} satisfies Meta<typeof InvoiceSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoInvoices: Story = {
  args: { invoices: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('No invoices yet')).toBeVisible();
  },
};

export const DepositDraftOnly: Story = {
  args: { invoices: [depositDraft] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Deposit')).toBeVisible();
    await expect(canvas.getByText('Draft')).toBeVisible();
  },
};

export const DepositSentBalanceDraft: Story = {
  args: { invoices: [depositSent, balanceDraft] },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByText('Balance')[0]).toBeVisible();
    await expect(canvas.getByText('Sent')).toBeVisible();
  },
};

export const BothPaid: Story = {
  args: { invoices: [depositPaid, balancePaid] },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByText('Paid')).toHaveLength(2);
  },
};
