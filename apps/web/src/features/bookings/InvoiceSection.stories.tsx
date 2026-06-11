import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
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

const bookingFixture = {
  id: 'b1', fee: '2000.00', sets: [], packages: [],
};

const baseHandlers = [
  http.get('/api/bookings/b1', () => HttpResponse.json(bookingFixture)),
  http.get('/api/bookings/b1/documents', () => HttpResponse.json([])),
];

const meta = {
  component: InvoiceSection,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
  args: { bookingId: 'b1' },
} satisfies Meta<typeof InvoiceSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoInvoices: Story = {
  parameters: {
    msw: { handlers: [...baseHandlers, http.get('/api/bookings/b1/invoices', () => HttpResponse.json([]))] },
  },
  play: async ({ canvas }) => {
    await expect(canvas.findByText('No invoices yet')).resolves.toBeVisible();
  },
};

export const DepositDraftOnly: Story = {
  parameters: {
    msw: { handlers: [...baseHandlers, http.get('/api/bookings/b1/invoices', () => HttpResponse.json([depositDraft]))] },
  },
  play: async ({ canvas }) => {
    await expect(canvas.findByText('Deposit')).resolves.toBeVisible();
    await expect(canvas.findByText('Draft')).resolves.toBeVisible();
  },
};

export const DepositSentBalanceDraft: Story = {
  parameters: {
    msw: { handlers: [...baseHandlers, http.get('/api/bookings/b1/invoices', () => HttpResponse.json([depositSent, balanceDraft]))] },
  },
  play: async ({ canvas }) => {
    await expect(canvas.findAllByText('Balance')).resolves.toSatisfy((els: HTMLElement[]) => els.length > 0);
    await expect(canvas.findByText('Sent')).resolves.toBeVisible();
  },
};

export const BothPaid: Story = {
  parameters: {
    msw: { handlers: [...baseHandlers, http.get('/api/bookings/b1/invoices', () => HttpResponse.json([depositPaid, balancePaid]))] },
  },
  play: async ({ canvas }) => {
    await expect(canvas.findAllByText('Paid')).resolves.toSatisfy((els: HTMLElement[]) => els.length >= 2);
  },
};
