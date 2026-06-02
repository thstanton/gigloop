import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ContactDetailPage from './ContactDetailPage';

const venueContact = {
  id: 'c1',
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:00:00Z',
  name: 'The O2 Arena',
  greetingName: null,
  email: 'events@theo2.co.uk',
  phone: '+44 20 8463 2000',
  website: null,
  notes: null,
  addressLine1: 'Peninsula Square',
  addressLine2: null,
  city: 'London',
  county: null,
  postcode: 'SE10 0DX',
  country: 'GB',
  latitude: 51.503,
  longitude: 0.0032,
  placeId: 'ChIJdd4hrwug2EcRmSrV3Vo6llI',
  travelTimeMinutes: null,
  travelDistanceMetres: null,
  travelTimeCalculatedAt: null,
  travelMode: null,
  parkingInfo: 'North Greenwich car park — show event confirmation for free entry.',
  accessInfo: 'Stage door on Drawdock Road. Security from 14:00.',
  equipmentAvailable: 'Full PA, lighting rig, grand piano.',
  commissionArrangement: null,
  primaryRole: 'VENUE',
  customerBookings: [],
  venueBookings: [
    { id: 'b1', title: "Sophie's Wedding", date: '2030-09-15', status: 'CONFIRMED', eventType: 'WEDDING' },
  ],
  bookingAgentBookings: [],
};

const customerContact = {
  id: 'c2',
  createdAt: '2024-02-01T09:00:00Z',
  updatedAt: '2024-02-01T09:00:00Z',
  name: 'Sophie Hartley',
  greetingName: 'Sophie',
  email: 'sophie@example.com',
  phone: '+44 7700 900456',
  website: null,
  notes: 'Repeat customer. Prefers evening calls.',
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
  commissionArrangement: null,
  primaryRole: 'CUSTOMER',
  customerBookings: [
    { id: 'b1', title: "Sophie's Wedding", date: '2030-09-15', status: 'CONFIRMED', eventType: 'WEDDING' },
  ],
  venueBookings: [],
  bookingAgentBookings: [],
};

function makeHandler(contact: object) {
  return [http.get('/api/contacts/:id', () => HttpResponse.json(contact))];
}

const meta = {
  component: ContactDetailPage,
  tags: ['autodocs'],
  decorators: [
    (Story) =>
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/admin/contacts/c1'] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: '/admin/contacts/:id', element: React.createElement(Story) }),
        ),
      ),
  ],
} satisfies Meta<typeof ContactDetailPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Venue: Story = {
  parameters: { msw: { handlers: makeHandler(venueContact) } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('The O2 Arena')).toBeVisible();
    await expect(canvas.getByText('Venue')).toBeVisible();
    await expect(canvas.getByText('Parking')).toBeVisible();
    await expect(canvas.getByText('Access')).toBeVisible();
  },
};

export const Customer: Story = {
  parameters: { msw: { handlers: makeHandler(customerContact) } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Sophie Hartley')).toBeVisible();
    await expect(canvas.getByText('Customer')).toBeVisible();
  },
};
