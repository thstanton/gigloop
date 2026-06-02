import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import ContractCard from './ContractCard';
import type { BookingDetail, Document } from '@/types/api';

const baseBooking: BookingDetail = {
  id: 'b1',
  createdAt: '2030-04-01T10:00:00Z',
  updatedAt: '2030-04-01T10:00:00Z',
  status: 'CONFIRMED',
  eventType: 'WEDDING',
  date: '2030-09-15T15:00:00Z',
  title: 'Smith Wedding',
  fee: '2000.00',
  notes: null,
  customerId: 'c1',
  customer: { id: 'c1', name: 'Jane Smith', email: 'jane@example.com', phone: null, addressLine1: null, addressLine2: null, city: null, county: null, postcode: null, country: null, latitude: null, longitude: null, placeId: null, travelTimeMinutes: null, travelDistanceMetres: null, travelTimeCalculatedAt: null, travelMode: null, notes: null, greetingName: 'Jane', primaryRole: 'CUSTOMER', parkingInfo: null, accessInfo: null, equipmentAvailable: null, website: null, commissionArrangement: null, createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z' },
  venueId: null,
  venue: null,
  bookingAgentId: null,
  bookingAgent: null,
  sets: [],
  packages: [],
  activeContract: null,
  depositReceivedAt: null,
  portalToken: 'tok_abc',
  hasMusicFormConfig: false,
  hasMusicFormResponse: false,
  seriesId: null,
  series: null,
};

const contractDoc: Document = {
  id: 'd1',
  createdAt: '2030-04-02T10:00:00Z',
  type: 'CONTRACT',
  url: 'https://example.com/contract.pdf',
  invoiceId: null,
  contractStatus: 'SIGNED',
};

const noop = () => {};

const meta = {
  component: ContractCard,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
  args: {
    isCreating: false,
    onCreateContract: noop,
    onEdit: noop,
    onPreview: noop,
    onSend: noop,
    onVoid: noop,
    onDelete: noop,
    documents: [],
  },
} satisfies Meta<typeof ContractCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { booking: { ...baseBooking, activeContract: null } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('No contracts yet')).toBeVisible();
    await expect(canvas.getByText('Create contract')).toBeVisible();
  },
};

export const Draft: Story = {
  args: {
    booking: {
      ...baseBooking,
      activeContract: {
        id: 'con1',
        createdAt: '2030-04-02T10:00:00Z',
        updatedAt: '2030-04-02T10:00:00Z',
        status: 'DRAFT',
        content: {},
        signedAt: null,
      },
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Draft')).toBeVisible();
    await expect(canvas.getByLabelText('Send contract')).toBeVisible();
    await expect(canvas.getByLabelText('Edit contract')).toBeVisible();
  },
};

export const Sent: Story = {
  args: {
    booking: {
      ...baseBooking,
      activeContract: {
        id: 'con1',
        createdAt: '2030-04-02T10:00:00Z',
        updatedAt: '2030-04-03T10:00:00Z',
        status: 'SENT',
        content: {},
        signedAt: null,
      },
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Sent')).toBeVisible();
    await expect(canvas.getByLabelText('Preview contract')).toBeVisible();
  },
};

export const Signed: Story = {
  args: {
    booking: {
      ...baseBooking,
      activeContract: {
        id: 'con1',
        createdAt: '2030-04-02T10:00:00Z',
        updatedAt: '2030-04-04T10:00:00Z',
        status: 'SIGNED',
        content: {},
        signedAt: '2030-04-04T10:00:00Z',
      },
    },
    documents: [contractDoc],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Signed')).toBeVisible();
    await expect(canvas.getByLabelText('Preview contract')).toBeVisible();
    await expect(canvas.getByLabelText('Download signed contract PDF')).toBeVisible();
  },
};

export const Void: Story = {
  args: {
    booking: {
      ...baseBooking,
      activeContract: {
        id: 'con1',
        createdAt: '2030-04-02T10:00:00Z',
        updatedAt: '2030-04-05T10:00:00Z',
        status: 'VOID',
        content: {},
        signedAt: null,
      },
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Void')).toBeVisible();
    await expect(canvas.getByText('Create contract')).toBeVisible();
  },
};

export const ConfirmVoidSignedDialog: Story = {
  args: {
    booking: {
      ...baseBooking,
      activeContract: {
        id: 'con1',
        createdAt: '2030-04-02T10:00:00Z',
        updatedAt: '2030-04-04T10:00:00Z',
        status: 'SIGNED',
        content: {},
        signedAt: '2030-04-04T10:00:00Z',
      },
    },
    documents: [contractDoc],
  },
  play: async ({ canvas }) => {
    const moreBtn = canvas.getByLabelText('More actions');
    await userEvent.click(moreBtn);
    const voidMenuItem = await within(document.body).findByText('Void contract');
    await userEvent.click(voidMenuItem);
    await expect(within(document.body).getByText('Void signed contract?')).toBeVisible();
  },
};
