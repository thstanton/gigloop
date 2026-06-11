import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { BookingVenueMapWidget } from './BookingVenueMapWidget';

const venueWithCoords = {
  id: 'c1', name: 'The Grand Hotel', email: 'events@grandhotel.com', phone: '+44 7700 900123',
  addressLine1: '1 Grand Parade', addressLine2: null, city: 'London', county: null, postcode: 'SW1A 1AA', country: 'GB',
  latitude: 51.5014, longitude: -0.1419, placeId: null,
  travelTimeMinutes: null, travelDistanceMetres: null, travelTimeCalculatedAt: null, travelMode: null,
  notes: null, greetingName: null, primaryRole: 'VENUE',
  parkingInfo: 'Use hotel car park.', accessInfo: null, equipmentAvailable: null,
  website: null, commissionArrangement: null,
  createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z',
};

const booking = {
  id: 'bd1', createdAt: '2030-04-01T10:00:00Z', updatedAt: '2030-04-01T10:00:00Z',
  eventType: 'WEDDING', date: '2030-09-15T15:00:00Z',
  title: "Sophie's Wedding", fee: '2000.00', notes: null, status: 'CONFIRMED',
  customerId: 'c2',
  customer: { id: 'c2', name: 'Sophie Hartley', email: 'sophie@example.com', phone: null, addressLine1: null, addressLine2: null, city: null, county: null, postcode: null, country: null, latitude: null, longitude: null, placeId: null, travelTimeMinutes: null, travelDistanceMetres: null, travelTimeCalculatedAt: null, travelMode: null, notes: null, greetingName: 'Sophie', primaryRole: 'CUSTOMER', parkingInfo: null, accessInfo: null, equipmentAvailable: null, website: null, commissionArrangement: null, createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z' },
  venueId: 'c1', venue: venueWithCoords,
  bookingAgentId: null, bookingAgent: null,
  sets: [], packages: [],
  activeContract: null, depositReceivedAt: null, portalToken: 'tok_abc',
  hasMusicFormConfig: false, hasMusicFormResponse: false,
  seriesId: null, series: null, logistics: null,
};

const userProfileWithCoords = {
  id: 'up1', userId: 'user_test',
  addressLine1: '10 Downing Street', addressLine2: null, city: 'London', county: null, postcode: 'SW1A 2AA', country: 'GB',
  latitude: 51.5034, longitude: -0.1276, placeId: null,
  bankDetails: null, vatNumber: null, vatRate: 20,
  depositPercentage: 30, defaultPaymentTermsDays: 30,
  invoiceNumberSequence: 0, invoiceSequenceYear: 2024,
  digestEmailEnabled: true, songRequestFormEnabled: true,
  createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
  onboardingCompletedAt: '2024-01-01T00:00:00Z',
  preferences: { reminderLeadDays: 7, checklistDefaults: [] },
};

const meta = {
  component: BookingVenueMapWidget,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
  args: {
    bookingId: 'bd1',
    contactHref: '/admin/contacts/c1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('/api/bookings/bd1', () => HttpResponse.json(booking)),
        http.get('/api/me', () => HttpResponse.json(userProfileWithCoords)),
        http.get('/api/contacts/c1/travel-time', () => HttpResponse.json({ minutes: 12, distanceMetres: 5200 })),
      ],
    },
  },
} satisfies Meta<typeof BookingVenueMapWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithTravelTime: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('The Grand Hotel')).toBeVisible();
    await expect(canvas.getByText('Venue')).toBeVisible();
  },
};

export const NoVenue: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/bookings/bd1', () => HttpResponse.json({ ...booking, venueId: null, venue: null })),
        http.get('/api/me', () => HttpResponse.json(userProfileWithCoords)),
      ],
    },
  },
};
