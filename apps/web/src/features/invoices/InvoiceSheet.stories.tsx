import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import InvoiceSheet from './InvoiceSheet';

function Providers({ children }: { children?: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </MemoryRouter>
  );
}

const noop = () => {};

const previewFresh = { invoiceNumber: 'INV-2026-007', willReuse: false };
const previewReuse = { invoiceNumber: 'INV-2026-003', willReuse: true };

const meta = {
  component: InvoiceSheet,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(Providers, {}, React.createElement(Story))],
  args: {
    bookingId: 'b1',
    hasDepositInvoice: false,
    open: true,
    onOpenChange: noop,
    onAfterIssue: noop,
  },
} satisfies Meta<typeof InvoiceSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

// Smoke: sheet renders with fresh preview number visible
export const NewInvoiceFreshNumber: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/bookings/b1/invoices/preview-number', () => HttpResponse.json(previewFresh)),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    // Sheet content portals to document.body, so query the body, not the canvas root.
    const canvas = within(canvasElement.ownerDocument.body);
    await waitFor(async () => {
      await expect(canvas.findByText(/INV-2026-007/)).resolves.toBeVisible();
    });
    await expect(canvas.findByText(/When issued/)).resolves.toBeVisible();
  },
};

// Void-reuse: shows "will be re-used" message when a voided slot exists
export const NewInvoiceVoidReuse: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/bookings/b1/invoices/preview-number', () => HttpResponse.json(previewReuse)),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await waitFor(async () => {
      await expect(canvas.findByText(/INV-2026-003/)).resolves.toBeVisible();
    });
    await expect(canvas.findByText(/will be re-used/)).resolves.toBeVisible();
  },
};

// Edit mode: no preview line (preview is only shown on create)
export const EditMode: Story = {
  args: {
    invoice: {
      id: 'i1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      status: 'DRAFT',
      isDeposit: false,
      invoiceNumber: null,
      issueDate: null,
      dueDate: null,
      paidAt: null,
      bookingId: 'b1',
      billToContactId: 'c1',
      billToContact: { id: 'c1', name: 'Jane Smith', email: null, phone: null, addressLine1: null, addressLine2: null, city: null, county: null, postcode: null, country: null, latitude: null, longitude: null, placeId: null, travelTimeMinutes: null, travelDistanceMetres: null, travelTimeCalculatedAt: null, travelMode: null, notes: null, greetingName: null, primaryRole: null, parkingInfo: null, accessInfo: null, equipmentAvailable: null, website: null, commissionArrangement: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
      lineItems: [{ id: 'li1', description: 'Performance fee', amount: '1500.00', order: 0, sourceBookingId: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await expect(canvas.findByText('Edit Invoice')).resolves.toBeVisible();
    await expect(canvas.findByText('Save changes')).resolves.toBeVisible();
  },
};
