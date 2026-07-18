import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import InvoiceSection from './InvoiceSection';
import type { Invoice } from '@/types/api';

const customer = { id: 'c1', name: 'Jane Smith', email: 'jane@example.com', phone: null, addressLine1: null, addressLine2: null, city: null, county: null, postcode: null, country: null, latitude: null, longitude: null, placeId: null, travelTimeMinutes: null, travelDistanceMetres: null, travelTimeCalculatedAt: null, travelMode: null, notes: null, greetingName: 'Jane', primaryRole: 'CUSTOMER', parkingInfo: null, accessInfo: null, equipmentAvailable: null, website: null, commissionArrangement: null, createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z' };
const lineItem = { id: 'li1', createdAt: '2030-04-01T00:00:00Z', updatedAt: '2030-04-01T00:00:00Z', description: 'Performance fee', amount: '1500.00', order: 0, sourceBookingId: null };

const depositDraft: Invoice = {
  id: 'inv1', createdAt: '2030-04-01T10:00:00Z', updatedAt: '2030-04-01T10:00:00Z',
  status: 'DRAFT', isDeposit: true, invoiceNumber: null,
  issueDate: null, dueDate: null, paidAt: null,
  bookingId: 'b1', seriesId: null, billToContactId: 'c1', billToContact: customer,
  lineItems: [{ ...lineItem, amount: '600.00' }],
};

const depositIssued: Invoice = { ...depositDraft, id: 'inv6', status: 'ISSUED', invoiceNumber: 'INV-001', issueDate: '2030-04-01', dueDate: '2030-05-01' };
const depositSent: Invoice = { ...depositDraft, id: 'inv2', status: 'SENT', invoiceNumber: 'INV-002', issueDate: '2030-04-01', dueDate: '2030-07-01' };
const balanceDraft: Invoice = { ...depositDraft, id: 'inv3', status: 'DRAFT', isDeposit: false, invoiceNumber: null, lineItems: [{ ...lineItem, amount: '1400.00' }] };
const depositPaid: Invoice = { ...depositDraft, id: 'inv4', status: 'PAID', invoiceNumber: 'INV-001', issueDate: '2030-04-01', dueDate: '2030-05-01', paidAt: '2030-05-02T10:00:00Z' };
const balancePaid: Invoice = { ...balanceDraft, id: 'inv5', status: 'PAID', invoiceNumber: 'INV-002', issueDate: '2030-04-01', paidAt: '2030-07-10T10:00:00Z' };

const bookingFixture = {
  id: 'b1', fee: '2000.00', sets: [], packages: [],
};

// The backing INVOICE document carries the backend portal-visibility verdict; the invoice row
// reads it (ADR-0054). SENT/PAID invoices are visible on the portal; a DRAFT has no document.
const invoiceDoc = (invoiceId: string, visible: boolean) => ({
  id: `doc-${invoiceId}`, createdAt: '2030-04-01T10:00:00Z', type: 'INVOICE',
  url: `https://example.com/${invoiceId}.pdf`, invoiceId, contractStatus: null, name: null,
  portalVisibility: visible ? { visible: true } : { visible: false, reason: 'until_sent' },
});

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
    msw: {
      handlers: [
        http.get('/api/bookings/b1', () => HttpResponse.json(bookingFixture)),
        http.get('/api/bookings/b1/documents', () => HttpResponse.json([invoiceDoc('inv2', true)])),
        http.get('/api/bookings/b1/invoices', () => HttpResponse.json([depositSent, balanceDraft])),
      ],
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.findAllByText('Balance')).resolves.toSatisfy((els: HTMLElement[]) => els.length > 0);
    await expect(canvas.findByText('Sent')).resolves.toBeVisible();
    // The sent invoice is live on the portal; the draft balance is not yet.
    await expect(canvas.findByText('Visible on Client Portal')).resolves.toBeVisible();
    await expect(canvas.findByText('Not visible until sent')).resolves.toBeVisible();
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

export const DepositIssued: Story = {
  parameters: {
    msw: { handlers: [...baseHandlers, http.get('/api/bookings/b1/invoices', () => HttpResponse.json([depositIssued]))] },
  },
  play: async ({ canvas }) => {
    await expect(canvas.findByText('Deposit')).resolves.toBeVisible();
    await expect(canvas.findByText('Issued')).resolves.toBeVisible();
  },
};
