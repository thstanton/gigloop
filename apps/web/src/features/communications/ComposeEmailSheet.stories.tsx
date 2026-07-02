import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import ComposeEmailSheet from './ComposeEmailSheet';
import type { BookingDetail, Invoice } from '@/types/api';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const customer = {
  id: 'c1', name: 'Sophie Hartley', email: 'sophie@example.com', phone: null,
  addressLine1: null, addressLine2: null, city: null, county: null, postcode: null,
  country: null, latitude: null, longitude: null, placeId: null,
  travelTimeMinutes: null, travelDistanceMetres: null, travelTimeCalculatedAt: null,
  travelMode: null, notes: null, greetingName: 'Sophie', primaryRole: 'CUSTOMER',
  parkingInfo: null, accessInfo: null, equipmentAvailable: null,
  website: null, commissionArrangement: null,
  createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z',
};

const booking: BookingDetail = {
  id: 'b1', createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z',
  status: 'CONFIRMED', eventType: 'WEDDING', date: '2030-09-15T15:00:00Z',
  title: "Sophie's Wedding", fee: '2000.00', notes: null,
  customerId: 'c1', customer,
  venueId: null, venue: null, bookingAgentId: null, bookingAgent: null,
  sets: [], packages: [], activeContract: null, depositReceivedAt: null,
  portalToken: 'tok1', hasMusicFormConfig: false, hasMusicFormResponse: false,
  portalVisibility: { contract: null, musicForm: null },
  seriesId: null, series: null, logistics: null,
} as unknown as BookingDetail;

// A booking whose music form is a DRAFT (on, not yet published) — the music-form invite is blocked.
const draftMusicBooking = {
  ...booking,
  hasMusicFormConfig: true,
  portalVisibility: { contract: null, musicForm: { visible: false, reason: 'until_published' } },
} as unknown as BookingDetail;

const musicInviteTemplate = {
  id: 'tpl-music', name: 'Music form invite', builtInType: 'music_form_invite',
  content: { type: 'doc', content: [] },
  createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z',
};

function makeInvoice(overrides: object): Invoice {
  return {
    id: 'inv1', createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z',
    bookingId: 'b1', billToContactId: 'c1', billToContact: customer,
    lineItems: [], paidAt: null, issueDate: '2030-04-01', dueDate: '2030-05-01',
    ...overrides,
  } as unknown as Invoice;
}

const issuedDepositInvoice = makeInvoice({ isDeposit: true, status: 'ISSUED', invoiceNumber: 'INV-2030-001' });
const voidDepositInvoice = makeInvoice({ id: 'inv2', isDeposit: true, status: 'VOID', invoiceNumber: 'INV-OLD-001' });

// ─── Template fixtures ────────────────────────────────────────────────────────

const depositCoverTemplate = {
  id: 'tpl-dep', name: 'Deposit invoice email', builtInType: 'deposit_invoice_cover',
  content: { type: 'doc', content: [] },
  createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z',
};

const confirmationTemplate = {
  id: 'tpl-conf', name: 'Booking confirmation', builtInType: 'confirmation',
  content: { type: 'doc', content: [] },
  createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z',
};

const renderResult = {
  subject: 'Your deposit invoice — Stanton Strings',
  body: '<p>Dear Sophie, please find your deposit invoice attached.</p>',
  missingVariables: [],
};

const confirmationRenderResult = {
  subject: 'Booking confirmed — Stanton Strings',
  body: '<p>Dear Sophie, we are delighted to confirm your booking.</p>',
  missingVariables: [],
};

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta = {
  component: ComposeEmailSheet,
  tags: ['ai-generated'],
  args: {
    bookingId: 'b1',
    booking,
    invoices: [] as Invoice[],
    defaultPaymentTermsDays: 30,
    open: true,
    onOpenChange: () => {},
  },
} satisfies Meta<typeof ComposeEmailSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Stories ──────────────────────────────────────────────────────────────────

// Present: ISSUED deposit invoice → paperclip bar shows filename
export const AttachmentPresent: Story = {
  args: {
    invoices: [issuedDepositInvoice],
    initialTemplateType: 'deposit_invoice_cover',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('/api/templates', () => HttpResponse.json([depositCoverTemplate])),
        http.get('/api/bookings/b1/communications/render', () => HttpResponse.json(renderResult)),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    // Sheet content portals to document.body, so query the body, not the canvas root.
    const canvas = within(canvasElement.ownerDocument.body);
    await waitFor(async () => {
      await expect(canvas.findByText('Invoice INV-2030-001.pdf')).resolves.toBeVisible();
    });
  },
};

// Warning: all deposit invoices are VOID → warning bar shown
export const AttachmentWarning: Story = {
  args: {
    invoices: [voidDepositInvoice],
    initialTemplateType: 'deposit_invoice_cover',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('/api/templates', () => HttpResponse.json([depositCoverTemplate])),
        http.get('/api/bookings/b1/communications/render', () => HttpResponse.json(renderResult)),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await waitFor(async () => {
      await expect(canvas.findByText('No deposit invoice to attach')).resolves.toBeVisible();
    });
  },
};

// #533 / #631: while the music form is a draft, the music-form-invite template is disabled in the
// picker (you can't email an invite for a form the client can't see).
export const MusicInviteBlockedWhileDraft: Story = {
  args: {
    booking: draftMusicBooking,
    invoices: [],
    initialTemplateType: 'confirmation',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('/api/templates', () => HttpResponse.json([confirmationTemplate, musicInviteTemplate])),
        http.get('/api/bookings/b1/communications/render', () => HttpResponse.json(confirmationRenderResult)),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await waitFor(async () => {
      await expect(canvas.findByText('Template')).resolves.toBeVisible();
    });
    // Open the template picker and find the music-invite option.
    await userEvent.click(canvas.getByRole('combobox'));
    const option = await canvas.findByText(/Music form invitation — publish the form first/i);
    const optionEl = option.closest('[role="option"]');
    expect(optionEl).toHaveAttribute('aria-disabled', 'true');
  },
};

// #631 backstop: if the invite template is already selected (e.g. pre-selected by a checklist
// shortcut) while the form is a draft, Send is disabled and the reason is explained — the disabled
// dropdown item alone doesn't cover an already-selected template.
export const MusicInviteSelectedButBlocked: Story = {
  args: {
    booking: draftMusicBooking,
    invoices: [],
    initialTemplateType: 'music_form_invite',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('/api/templates', () => HttpResponse.json([musicInviteTemplate])),
        http.get('/api/bookings/b1/communications/render', () =>
          HttpResponse.json({ subject: 'Your music form', body: '<p>Choose your songs.</p>', missingVariables: [] }),
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await waitFor(async () => {
      await expect(canvas.findByText(/isn't published yet/i)).resolves.toBeVisible();
    });
    await expect(canvas.getByRole('button', { name: /^send$/i })).toBeDisabled();
  },
};

// Absent: non-invoice template → no attachment bar at all
export const NoAttachment: Story = {
  args: {
    invoices: [],
    initialTemplateType: 'confirmation',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('/api/templates', () => HttpResponse.json([confirmationTemplate])),
        http.get('/api/bookings/b1/communications/render', () => HttpResponse.json(confirmationRenderResult)),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    // Wait for render to complete (subject line populated)
    await waitFor(async () => {
      await expect(canvas.findByDisplayValue('Booking confirmed — Stanton Strings')).resolves.toBeVisible();
    });
    // No attachment indicator present
    expect(canvas.queryByText(/invoice.*pdf/i)).toBeNull();
    expect(canvas.queryByText(/no.*invoice to attach/i)).toBeNull();
  },
};
