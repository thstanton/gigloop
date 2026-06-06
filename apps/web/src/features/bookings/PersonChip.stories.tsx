import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import PersonChip from './PersonChip';
import type { Contact } from '@/types/api';

const baseContact: Omit<Contact, 'id' | 'name' | 'email' | 'phone' | 'commissionArrangement' | 'primaryRole'> = {
  createdAt: '2030-01-01T00:00:00Z',
  updatedAt: '2030-01-01T00:00:00Z',
  greetingName: null,
  notes: null,
  addressLine1: null, addressLine2: null, city: null, county: null, postcode: null, country: null,
  latitude: null, longitude: null, placeId: null,
  travelTimeMinutes: null, travelDistanceMetres: null, travelTimeCalculatedAt: null, travelMode: null,
  parkingInfo: null, accessInfo: null, equipmentAvailable: null, website: null,
};

const customerFull: Contact = {
  ...baseContact,
  id: 'c1', name: 'Jane Smith', email: 'jane@example.com', phone: '+44 7700 900111',
  commissionArrangement: null, primaryRole: 'CUSTOMER',
};

const customerPhoneOnly: Contact = {
  ...baseContact,
  id: 'c2', name: 'Jane Smith', email: null, phone: '+44 7700 900111',
  commissionArrangement: null, primaryRole: 'CUSTOMER',
};

const bookingAgentWithCommission: Contact = {
  ...baseContact,
  id: 'c3', name: 'Premier Events Agency', email: 'bookings@premierevents.com', phone: '+44 20 7946 0100',
  commissionArrangement: '15% of gross fee', primaryRole: 'BOOKING_AGENT',
};

const bookingAgentMinimal: Contact = {
  ...baseContact,
  id: 'c4', name: 'Local Music Agency', email: null, phone: null,
  commissionArrangement: null, primaryRole: 'BOOKING_AGENT',
};

const meta = {
  component: PersonChip,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
  args: { onEdit: () => {} },
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
} satisfies Meta<typeof PersonChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CustomerFull: Story = {
  name: 'Customer — full details',
  args: { role: 'Customer', contact: customerFull },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Jane Smith')).toBeVisible();
    await expect(canvas.getByText('Customer')).toBeVisible();
    // Open popover and verify actions
    await userEvent.click(canvas.getByRole('button'));
    const body = within(document.body);
    await expect(body.getByText('Edit')).toBeVisible();
    await expect(body.getByText('Call')).toBeVisible();
    await expect(body.getByText('Email')).toBeVisible();
    await expect(body.getByText('View contact')).toBeVisible();
  },
};

export const CustomerPhoneOnly: Story = {
  name: 'Customer — phone only',
  args: { role: 'Customer', contact: customerPhoneOnly },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button'));
    const body = within(document.body);
    await expect(body.getByText('Call')).toBeVisible();
    await expect(body.queryByText('Email')).toBeNull();
  },
};

export const BookingAgentWithCommission: Story = {
  name: 'Booking agent — with commission',
  args: { role: 'Booking agent', contact: bookingAgentWithCommission },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Booking agent')).toBeVisible();
    await userEvent.click(canvas.getByRole('button'));
    const body = within(document.body);
    await expect(body.getByText('Commission')).toBeVisible();
    await expect(body.getByText('15% of gross fee')).toBeVisible();
  },
};

export const BookingAgentMinimal: Story = {
  name: 'Booking agent — no extras',
  args: { role: 'Booking agent', contact: bookingAgentMinimal },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button'));
    const body = within(document.body);
    await expect(body.queryByText('Commission')).toBeNull();
    await expect(body.queryByText('Call')).toBeNull();
    await expect(body.queryByText('Email')).toBeNull();
    await expect(body.getByText('View contact')).toBeVisible();
  },
};
