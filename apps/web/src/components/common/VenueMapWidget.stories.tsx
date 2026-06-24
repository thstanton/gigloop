import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import { VenueMapWidget } from './VenueMapWidget';

const venue = {
  name: 'The O2 Arena',
  email: 'events@theo2.co.uk',
  phone: '+44 20 8463 2000',
  addressLine1: 'Peninsula Square',
  addressLine2: null,
  city: 'London',
  postcode: 'SE10 0DX',
  latitude: 51.503,
  longitude: 0.0032,
  parkingInfo: 'Use the North Greenwich car park. Show event confirmation for free entry.',
  accessInfo: 'Stage door on Drawdock Road. Security desk open from 14:00.',
  equipmentAvailable: 'Full PA, lighting rig, grand piano.',
};

const venueNoCoords = { ...venue, latitude: null, longitude: null };

const meta = {
  title: 'Common/VenueMapWidget',
  component: VenueMapWidget,
  tags: ['autodocs'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
  args: {
    venue,
    onRefreshTravelTime: fn(),
  },
} satisfies Meta<typeof VenueMapWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Booking detail page — card title + edit action + full header + travel + map. */
export const BookingPage: Story = {
  args: {
    showHeader: true,
    cardTitle: 'Venue',
    cardAction: React.createElement('button', { type: 'button', className: 'text-xs text-primary hover:text-primary/80 transition-colors' }, 'Edit'),
    travelTime: { minutes: 45, distanceMetres: 32000 },
    isLoadingTravelTime: false,
    contactHref: '/admin/contacts/v1',
  },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByText('Venue')).toBeVisible();
    await expect(canvas.getByText('The O2 Arena')).toBeVisible();
    await expect(canvas.getByText('Peninsula Square, London, SE10 0DX')).toBeVisible();
    await expect(canvas.getByText('Parking')).toBeVisible();
    await expect(canvas.getByText('Access')).toBeVisible();
    await expect(canvas.getByText('Equipment')).toBeVisible();
    await expect(canvas.getByText('~45 min · 32.0 km driving')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: /refresh travel time/i }));
    await expect(args.onRefreshTravelTime).toHaveBeenCalledOnce();
  },
};

/** Contact detail page — header hidden (name/contact shown elsewhere on the page). */
export const ContactPage: Story = {
  args: {
    showHeader: false,
    travelTime: { minutes: 45, distanceMetres: 32000 },
    isLoadingTravelTime: false,
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText('The O2 Arena')).toBeNull();
    await expect(canvas.getByText('Parking')).toBeVisible();
    await expect(canvas.getByText('~45 min · 32.0 km driving')).toBeVisible();
  },
};

export const LoadingTravelTime: Story = {
  args: {
    showHeader: true,
    travelTime: null,
    isLoadingTravelTime: true,
    contactHref: '/admin/contacts/v1',
  },
};

export const NoTravelTime: Story = {
  args: {
    showHeader: true,
    travelTime: null,
    isLoadingTravelTime: false,
    contactHref: '/admin/contacts/v1',
  },
};

/** Venue is geocoded but the musician has no home address — prompt to add it. */
export const NoHomeAddress: Story = {
  args: {
    showHeader: true,
    travelTime: null,
    isLoadingTravelTime: false,
    homeAddressMissing: true,
    contactHref: '/admin/contacts/v1',
  },
  play: async ({ canvas }) => {
    const link = canvas.getByRole('link', { name: /add your home address/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/admin/settings');
    // The generic failure text and the (useless) refresh button are suppressed.
    await expect(canvas.queryByText('Travel time unavailable')).toBeNull();
    await expect(canvas.queryByRole('button', { name: /refresh travel time/i })).toBeNull();
  },
};

export const NoAddress: Story = {
  args: {
    venue: venueNoCoords,
    showHeader: true,
    travelTime: null,
    isLoadingTravelTime: false,
    onRefreshTravelTime: undefined,
    contactHref: '/admin/contacts/v1',
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('No map yet')).toBeVisible();
    await expect(canvas.getByText(/add a full address/i)).toBeVisible();
  },
};
