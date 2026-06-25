import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within, userEvent } from 'storybook/test';
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

const draftInvoice = {
  id: 'i1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  status: 'DRAFT' as const,
  isDeposit: false,
  invoiceNumber: null,
  issueDate: null,
  dueDate: null,
  paidAt: null,
  bookingId: 'b1',
  billToContactId: 'c1',
  billToContact: { id: 'c1', name: 'Jane Smith', email: null, phone: null, addressLine1: null, addressLine2: null, city: null, county: null, postcode: null, country: null, latitude: null, longitude: null, placeId: null, travelTimeMinutes: null, travelDistanceMetres: null, travelTimeCalculatedAt: null, travelMode: null, notes: null, greetingName: null, primaryRole: null, parkingInfo: null, accessInfo: null, equipmentAvailable: null, website: null, commissionArrangement: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  lineItems: [{ id: 'li1', description: 'Performance fee', amount: '1500.00', order: 0, sourceBookingId: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }],
};

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
  args: { invoice: draftInvoice },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await expect(canvas.findByText('Edit Invoice')).resolves.toBeVisible();
    await expect(canvas.findByText('Save changes')).resolves.toBeVisible();
  },
};

// Edit mode on a DRAFT: the Issue control is the primary action and opens the lock confirmation
export const EditModeDraftIssue: Story = {
  args: { invoice: draftInvoice },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    const issueButton = await canvas.findByRole('button', { name: 'Issue invoice' });
    await expect(issueButton).toBeVisible();
    // Both the issue and save paths are offered on a draft.
    await expect(canvas.findByText('Save changes')).resolves.toBeVisible();

    // Issuing locks the invoice, so it must route through the confirmation step.
    await userEvent.click(issueButton);
    await waitFor(async () => {
      await expect(canvas.findByText('Issue and lock this invoice?')).resolves.toBeVisible();
    });
  },
};

// Issuing a draft is WYSIWYG: unsaved line-item edits are persisted *before* the irreversible
// issue, so what the user sees is what gets locked (regression guard for the silent-discard bug).
const issueFlowCalls: string[] = [];
export const EditModeDraftIssueSavesEdits: Story = {
  args: { invoice: draftInvoice },
  parameters: {
    msw: {
      handlers: [
        http.patch('/api/bookings/b1/invoices/i1/line-items/:lineId', () => {
          issueFlowCalls.push('save');
          return HttpResponse.json({});
        }),
        http.post('/api/bookings/b1/invoices/i1/issue', () => {
          issueFlowCalls.push('issue');
          return HttpResponse.json({ ...draftInvoice, status: 'ISSUED' });
        }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    issueFlowCalls.length = 0;
    const canvas = within(canvasElement.ownerDocument.body);

    // Edit the amount without clicking Save changes…
    const amountInput = await canvas.findByDisplayValue('1500');
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, '1800');

    // …then issue straight from the primary button.
    await userEvent.click(await canvas.findByRole('button', { name: 'Issue invoice' }));
    const confirmTitle = await canvas.findByText('Issue and lock this invoice?');
    const confirmDialog = confirmTitle.closest('[role="dialog"]') as HTMLElement;
    await userEvent.click(within(confirmDialog).getByRole('button', { name: 'Issue invoice' }));

    // The edit must be saved before the issue locks the invoice — order matters.
    await waitFor(() => expect(issueFlowCalls).toEqual(['save', 'issue']));
  },
};
