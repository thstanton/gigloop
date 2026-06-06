import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import PersonCard from './PersonCard';
import type { Contact } from '@/types/api';

const customer: Contact = {
  id: 'c1', name: 'Jane Smith', email: 'jane@example.com', phone: '+44 7700 900111',
  addressLine1: null, addressLine2: null, city: null, county: null, postcode: null, country: null,
  latitude: null, longitude: null, placeId: null,
  travelTimeMinutes: null, travelDistanceMetres: null, travelTimeCalculatedAt: null, travelMode: null,
  notes: null, greetingName: 'Jane', primaryRole: 'CUSTOMER',
  parkingInfo: null, accessInfo: null, equipmentAvailable: null, website: null,
  commissionArrangement: null, createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z',
};

const bookingAgent: Contact = {
  id: 'c2', name: 'Premier Events Agency', email: 'bookings@premierevents.com', phone: null,
  addressLine1: null, addressLine2: null, city: null, county: null, postcode: null, country: null,
  latitude: null, longitude: null, placeId: null,
  travelTimeMinutes: null, travelDistanceMetres: null, travelTimeCalculatedAt: null, travelMode: null,
  notes: null, greetingName: null, primaryRole: 'BOOKING_AGENT',
  parkingInfo: null, accessInfo: null, equipmentAvailable: null, website: null,
  commissionArrangement: '15% of gross fee', createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z',
};

const meta = {
  component: PersonCard,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
  args: { onEdit: () => {} },
} satisfies Meta<typeof PersonCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CustomerRole: Story = {
  args: { role: 'Customer', contact: customer },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Customer')).toBeVisible();
    await expect(canvas.getByText('Jane Smith')).toBeVisible();
  },
};

export const BookingAgentWithCommission: Story = {
  args: {
    role: 'Booking agent',
    contact: bookingAgent,
    commissionArrangement: bookingAgent.commissionArrangement ?? undefined,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Booking agent')).toBeVisible();
    await expect(canvas.getByText('Commission')).toBeVisible();
    await expect(canvas.getByText(/15% of gross fee/)).toBeVisible();
  },
};

export const DesktopWithAvatar: Story = {
  name: 'Desktop — avatar visible',
  args: { role: 'Customer', contact: customer },
  parameters: {
    viewport: { defaultViewport: 'tablet' },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('JS')).toBeVisible();
    await expect(canvas.getByText('Jane Smith')).toBeVisible();
  },
};
