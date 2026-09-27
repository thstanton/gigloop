import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CommunicationsSection from './CommunicationsSection';
import { bandMember } from '@/test/factories';
import type { BookingBandMember, Communication, Contact } from '@/types/api';

const musicianContact: Contact = {
  id: 'contact-1',
  createdAt: '2030-01-01T00:00:00Z',
  updatedAt: '2030-01-01T00:00:00Z',
  name: 'Dave Chambers',
  greetingName: 'Dave',
  email: 'dave@example.com',
  phone: null,
  notes: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  county: null,
  postcode: null,
  country: null,
  latitude: null,
  longitude: null,
  placeId: null,
  travelTimeMinutes: null,
  travelDistanceMetres: null,
  travelTimeCalculatedAt: null,
  travelMode: null,
  parkingInfo: null,
  accessInfo: null,
  equipmentAvailable: null,
  website: null,
  commissionArrangement: null,
  primaryRole: 'BAND_MEMBER',
  primaryBandRole: null,
  instruments: [],
  travelNotes: null,
  equipmentNotes: null,
  outfitNotes: null,
  availabilityNotes: null,
};

const member: BookingBandMember = bandMember({
  id: 'member-1',
  contactId: musicianContact.id,
  contact: musicianContact,
});

function communication(overrides: Partial<Communication> = {}): Communication {
  return {
    id: 'comm-1',
    createdAt: '2030-05-02T10:00:00Z',
    updatedAt: '2030-05-02T10:00:00Z',
    direction: 'OUTBOUND',
    channel: 'EMAIL',
    status: 'SENT',
    subject: 'Your call sheet',
    body: '<p>Here is your call sheet.</p>',
    sentAt: '2030-05-02T10:00:00Z',
    bookingId: 'booking-1',
    seriesId: null,
    contactId: musicianContact.id,
    contact: musicianContact,
    templateId: 'template-1',
    template: {
      id: 'template-1',
      createdAt: '2030-01-01T00:00:00Z',
      updatedAt: '2030-01-01T00:00:00Z',
      name: 'Band call sheet email',
      content: {},
      builtInType: 'band_call_sheet',
    },
    document: { id: 'document-1', invoiceId: null },
    ...overrides,
  };
}

function renderSection(communications: Communication[]) {
  render(
    <MemoryRouter>
      <CommunicationsSection
        communications={communications}
        bandMembers={[member]}
        bandCommunicationsEnabled
      />
    </MemoryRouter>,
  );
}

describe('CommunicationsSection band attachment tracking', () => {
  it('links an emailed call sheet but never shows attachments on MANUAL rows or rows without a document', async () => {
    renderSection([
      communication(),
      communication({
        id: 'comm-manual',
        channel: 'MANUAL',
        subject: 'Call sheet message',
        template: {
          id: 'template-2',
          createdAt: '2030-01-01T00:00:00Z',
          updatedAt: '2030-01-01T00:00:00Z',
          name: 'Band call sheet message',
          content: {},
          builtInType: 'band_call_sheet_message',
        },
        document: { id: 'misleading-document', invoiceId: 'invoice-1' },
      }),
      communication({
        id: 'comm-no-document',
        subject: 'Final details',
        document: null,
      }),
    ]);

    await userEvent.click(screen.getByRole('tab', { name: 'Band' }));

    const emailRow = screen.getByRole('button', { name: 'View email: Your call sheet' });
    expect(within(emailRow).getByRole('link', { name: 'Download attached call sheet PDF' })).toHaveAttribute(
      'href',
      expect.stringContaining('/documents/document-1/download'),
    );
    const manualRow = screen.getByRole('button', { name: 'View message: Call sheet message' });
    expect(within(manualRow).queryByRole('link')).not.toBeInTheDocument();
    const noDocumentRow = screen.getByRole('button', { name: 'View email: Final details' });
    expect(within(noDocumentRow).queryByRole('link')).not.toBeInTheDocument();
  });
});
