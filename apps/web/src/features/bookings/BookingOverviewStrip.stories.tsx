import { Meta, StoryObj } from '@storybook/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import BookingOverviewStrip from './BookingOverviewStrip';
import type { BookingDetail, UserProfile } from '@/types/api';

const meta: Meta<typeof BookingOverviewStrip> = {
  component: BookingOverviewStrip,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof BookingOverviewStrip>;

const mockContact = {
  id: 'c1',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
  name: 'Sarah Johnson',
  greetingName: null,
  email: 'sarah@example.com',
  phone: '555-1234',
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
  primaryRole: null,
};

const mockVenue = {
  ...mockContact,
  id: 'v1',
  name: 'The Grand Ballroom',
  email: 'contact@ballroom.com',
  phone: '555-5678',
  addressLine1: '123 Main St',
  city: 'City',
  country: 'State',
};

const mockBooking: BookingDetail = {
  id: 'b1',
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
  status: 'CONFIRMED',
  eventType: 'WEDDING',
  date: '2026-08-15T18:00:00Z',
  title: 'Wedding Reception',
  fee: '2500',
  notes: null,
  customerId: 'c1',
  customer: mockContact,
  venueId: 'v1',
  venue: mockVenue,
  bookingAgentId: null,
  bookingAgent: null,
  sets: [],
  series: null,
  seriesId: null,
  packages: [],
  depositReceivedAt: null,
  portalToken: 'portal-token-123',
  hasMusicFormConfig: false,
  hasMusicFormResponse: false,
  portalVisibility: { contract: null, musicForm: null },
  logistics: null,
  activeContract: null,
};

const mockBookingWithSeries: BookingDetail = {
  ...mockBooking,
  series: {
    id: 's1',
    label: 'Summer Weddings 2026',
    customerId: 'c1',
  },
  seriesId: 's1',
};

const mockUserProfile: UserProfile = {
  id: 'user1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  addressLine1: null,
  addressLine2: null,
  city: null,
  county: null,
  postcode: null,
  country: null,
  latitude: null,
  longitude: null,
  placeId: null,
  bankDetails: null,
  vatNumber: 'GB123456789',
  vatRate: 20,
  defaultPaymentTermsDays: 14,
  invoiceNumberSequence: 1,
  invoiceSequenceYear: 2026,
  depositPercentage: 50,
  digestEmailEnabled: false,
  songRequestFormEnabled: false,
  preferences: {},
  onboardingCompletedAt: null,
};

export const Confirmed: Story = {
  args: {
    bookingId: 'b1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('/api/bookings/b1', () => HttpResponse.json(mockBooking)),
        http.patch('/api/bookings/b1', () => HttpResponse.json(mockBooking)),
        http.get('/api/me', () => HttpResponse.json(mockUserProfile)),
      ],
    },
  },
};

export const WithSeries: Story = {
  args: {
    bookingId: 'b1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('/api/bookings/b1', () => HttpResponse.json(mockBookingWithSeries)),
        http.patch('/api/bookings/b1', () => HttpResponse.json(mockBookingWithSeries)),
        http.get('/api/me', () => HttpResponse.json(mockUserProfile)),
      ],
    },
  },
};
