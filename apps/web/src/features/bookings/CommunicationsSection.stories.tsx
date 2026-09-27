import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import CommunicationsSection from './CommunicationsSection';
import { bandMember } from '@/test/factories';
import type { BookingBandMember, Communication } from '@/types/api';

const contact = { id: 'c1', name: 'Jane Smith', email: 'jane@example.com', phone: null, addressLine1: null, addressLine2: null, city: null, county: null, postcode: null, country: null, latitude: null, longitude: null, placeId: null, travelTimeMinutes: null, travelDistanceMetres: null, travelTimeCalculatedAt: null, travelMode: null, notes: null, greetingName: 'Jane', primaryRole: 'CUSTOMER', parkingInfo: null, accessInfo: null, equipmentAvailable: null, website: null, commissionArrangement: null, primaryBandRole: null, instruments: [], travelNotes: null, equipmentNotes: null, outfitNotes: null, availabilityNotes: null, createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z' };

const sentEmail: Communication = {
  id: 'cm1', createdAt: '2030-04-02T10:00:00Z', updatedAt: '2030-04-02T10:00:00Z',
  direction: 'OUTBOUND', channel: 'EMAIL', status: 'SENT',
  subject: 'Confirmation of your booking', body: '<p>Dear Jane, your booking is confirmed.</p>',
  sentAt: '2030-04-02T10:00:00Z', bookingId: 'b1', seriesId: null, contactId: 'c1', contact,
  templateId: null, template: null, document: null,
};

const pendingEmail: Communication = {
  id: 'cm2', createdAt: '2030-04-03T09:00:00Z', updatedAt: '2030-04-03T09:00:00Z',
  direction: 'OUTBOUND', channel: 'EMAIL', status: 'PENDING',
  subject: 'Your invoice is attached', body: '<p>Please find your invoice attached.</p>',
  sentAt: null, bookingId: 'b1', seriesId: null, contactId: 'c1', contact,
  templateId: null, template: null, document: null,
};

const failedEmail: Communication = {
  id: 'cm3', createdAt: '2030-04-04T08:00:00Z', updatedAt: '2030-04-04T08:00:00Z',
  direction: 'OUTBOUND', channel: 'EMAIL', status: 'FAILED',
  subject: 'Thank you for a wonderful evening', body: '<p>It was a pleasure to perform for you.</p>',
  sentAt: null, bookingId: 'b1', seriesId: null, contactId: 'c1', contact,
  templateId: null, template: null, document: null,
};

const invoiceSentEmail: Communication = {
  id: 'cm4', createdAt: '2030-04-05T11:00:00Z', updatedAt: '2030-04-05T11:00:00Z',
  direction: 'OUTBOUND', channel: 'EMAIL', status: 'SENT',
  subject: 'Your balance invoice — Stanton Strings',
  body: '<p>Dear Jane, please find your invoice attached.</p>',
  sentAt: '2030-04-05T11:00:00Z', bookingId: 'b1', seriesId: null, contactId: 'c1', contact,
  templateId: 'tmpl1', template: { id: 'tmpl1', name: 'Balance invoice cover', content: {}, builtInType: 'balance_invoice_cover', createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z' },
  document: { id: 'doc1', invoiceId: 'inv1' },
};

// ADR-0080: a series communication has no bookingId — it's merged into every member booking's
// list via seriesId instead, and marked with the "Series" badge so it reads as series-level.
const seriesInvoiceSentEmail: Communication = {
  id: 'cm5', createdAt: '2030-04-06T12:00:00Z', updatedAt: '2030-04-06T12:00:00Z',
  direction: 'OUTBOUND', channel: 'EMAIL', status: 'SENT',
  subject: 'Your invoice — Hotel Intercontinental residency',
  body: '<p>Dear Jane, please find your series invoice attached.</p>',
  sentAt: '2030-04-06T12:00:00Z', bookingId: null, seriesId: 's1', contactId: 'c1', contact,
  templateId: 'tmpl2', template: { id: 'tmpl2', name: 'Series invoice cover', content: {}, builtInType: 'series_invoice_cover', createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z' },
  document: { id: 'doc2', invoiceId: 'inv2' },
};

const dave = { ...contact, id: 'band-contact-1', name: 'Dave Chambers', email: 'dave@example.com' };
const priya = { ...contact, id: 'band-contact-2', name: 'Priya Shah', email: null };
const sam = { ...contact, id: 'band-contact-3', name: 'Sam Taylor', email: null };
const bandMembers: BookingBandMember[] = [
  bandMember({ id: 'member-1', contactId: dave.id, contact: dave }),
  bandMember({ id: 'member-2', contactId: priya.id, contact: priya }),
  bandMember({ id: 'member-3', contactId: sam.id, contact: sam }),
];

const bandCallSheetEmail: Communication = {
  ...sentEmail,
  id: 'cm-band-email',
  createdAt: '2030-05-02T10:00:00Z',
  updatedAt: '2030-05-02T10:00:00Z',
  subject: 'Your call sheet — 2 May 2030',
  sentAt: '2030-05-02T10:00:00Z',
  contactId: dave.id,
  contact: dave,
  templateId: 'band-call-sheet-email',
  template: { id: 'band-call-sheet-email', name: 'Band call sheet email', content: {}, builtInType: 'band_call_sheet', createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z' },
  document: { id: 'call-sheet-document', invoiceId: null },
};

const bandCallSheetManual: Communication = {
  ...bandCallSheetEmail,
  id: 'cm-band-manual',
  channel: 'MANUAL',
  subject: 'Call sheet message — 2 May 2030',
  contactId: priya.id,
  contact: priya,
  templateId: 'band-call-sheet-message',
  template: { id: 'band-call-sheet-message', name: 'Band call sheet message', content: {}, builtInType: 'band_call_sheet_message', createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z' },
  // Even if a stale or malformed manual row has a document relation, it must not claim delivery.
  document: { id: 'manual-document', invoiceId: 'inv1' },
};

const meta = {
  component: CommunicationsSection,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
  parameters: { viewport: { defaultViewport: 'mobile2' } },
} satisfies Meta<typeof CommunicationsSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { communications: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('No emails sent yet')).toBeVisible();
    await expect(canvas.getByText('Send email')).toBeVisible();
  },
};

export const WithSentEmail: Story = {
  args: { communications: [sentEmail] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Confirmation of your booking')).toBeVisible();
  },
};

export const WithPendingEmail: Story = {
  args: { communications: [pendingEmail] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Your invoice is attached')).toBeVisible();
  },
};

export const WithFailedEmail: Story = {
  args: { communications: [failedEmail] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Thank you for a wonderful evening')).toBeVisible();
    await expect(canvas.getByText(/Send failed/)).toBeVisible();
  },
};

export const WithInvoiceAttachment: Story = {
  args: { communications: [invoiceSentEmail] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Your balance invoice — Stanton Strings')).toBeVisible();
    await expect(canvas.getByRole('link', { name: /Download attached invoice PDF/i })).toBeVisible();
  },
};

export const WithSeriesInvoiceAttachment: Story = {
  args: { communications: [seriesInvoiceSentEmail] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Your invoice — Hotel Intercontinental residency')).toBeVisible();
    await expect(canvas.getByText('Series')).toBeVisible();
    const pdfLink = canvas.getByRole('link', { name: /Download attached invoice PDF/i });
    await expect(pdfLink).toBeVisible();
    // #853, ADR-0069: invoice routes are owner-agnostic — a series row's PDF resolves through
    // the same /invoices/:id path as a booking row's, with no owner prefix.
    await expect(pdfLink).toHaveAttribute('href', expect.stringContaining('/invoices/inv2/preview.pdf'));
  },
};

export const MixedEmails: Story = {
  args: { communications: [invoiceSentEmail, sentEmail, pendingEmail, failedEmail] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Your balance invoice — Stanton Strings')).toBeVisible();
    await expect(canvas.getByRole('link', { name: /Download attached invoice PDF/i })).toBeVisible();
    await expect(canvas.getByText('Confirmation of your booking')).toBeVisible();
  },
};

export const ClientOnly: Story = {
  name: 'Client communications with no band members',
  args: { communications: [sentEmail], bandMembers: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Confirmation of your booking')).toBeVisible();
    await expect(canvas.queryByRole('tab', { name: 'Client' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('tab', { name: 'Band' })).not.toBeInTheDocument();
  },
};

export const BandWithMixedChannels: Story = {
  args: {
    communications: [sentEmail, bandCallSheetEmail, bandCallSheetManual],
    bandMembers,
    bandCommunicationsEnabled: true,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('tab', { name: 'Client' })).toBeVisible();
    await expect(canvas.getByText('Confirmation of your booking')).toBeVisible();
    await expect(canvas.queryByText('Your call sheet — 2 May 2030')).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole('tab', { name: 'Band' }));

    await expect(canvas.getByText('Dave Chambers')).toBeVisible();
    await expect(canvas.getByText('Priya Shah')).toBeVisible();
    await expect(canvas.getByText('Sam Taylor')).toBeVisible();
    await expect(canvas.getByText('No messages recorded')).toBeVisible();
    await expect(canvas.getByText(/Email · Band call sheet email/)).toBeVisible();
    await expect(canvas.getByText(/Marked as sent · Band call sheet message/)).toBeVisible();
    await expect(canvas.getAllByText(/2 May 2030,/)).toHaveLength(2);
    await expect(canvas.getByRole('link', { name: /Download attached call sheet PDF/i })).toBeVisible();
    await expect(canvas.queryByRole('link', { name: /Download attached invoice PDF/i })).not.toBeInTheDocument();
    await expect(canvas.queryByText('Confirmation of your booking')).not.toBeInTheDocument();
  },
};

export const NoMembers: Story = {
  name: 'No members — tabs stay hidden',
  args: { communications: [], bandMembers: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('No emails sent yet')).toBeVisible();
    await expect(canvas.queryByRole('tab', { name: 'Client' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('tab', { name: 'Band' })).not.toBeInTheDocument();
  },
};

export const BandFeatureFlagOff: Story = {
  name: 'Band feature flag off — keep the existing trail',
  args: {
    communications: [bandCallSheetEmail],
    bandMembers,
    bandCommunicationsEnabled: false,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Your call sheet — 2 May 2030')).toBeVisible();
    await expect(canvas.queryByRole('tab', { name: 'Client' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('tab', { name: 'Band' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('link', { name: /Download attached call sheet PDF/i })).not.toBeInTheDocument();
  },
};
