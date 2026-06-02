import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import VenueCard from './VenueCard';
import type { Contact } from '@/types/api';

const minimalVenue: Contact = {
  id: 'v1', name: 'The Grand Ballroom', email: null, phone: null,
  addressLine1: null, addressLine2: null, city: null, county: null, postcode: null, country: null,
  latitude: null, longitude: null, placeId: null,
  travelTimeMinutes: null, travelDistanceMetres: null, travelTimeCalculatedAt: null, travelMode: null,
  notes: null, greetingName: null, primaryRole: 'VENUE',
  parkingInfo: null, accessInfo: null, equipmentAvailable: null,
  website: null, commissionArrangement: null, createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z',
};

const fullVenue: Contact = {
  id: 'v2', name: 'Kensington Palace', email: 'events@kensingtonpalace.co.uk', phone: '+44 20 7937 9561',
  addressLine1: '1 Kensington Palace', addressLine2: null, city: 'London', county: null, postcode: 'W8 4PX', country: 'GB',
  latitude: null, longitude: null, placeId: null,
  travelTimeMinutes: null, travelDistanceMetres: null, travelTimeCalculatedAt: null, travelMode: null,
  notes: null, greetingName: null, primaryRole: 'VENUE',
  parkingInfo: 'Use Kensington Road car park. Mention the event for free entry.',
  accessInfo: 'Side entrance on Palace Gate. Knock three times.',
  equipmentAvailable: 'Grand piano, PA system, lectern.',
  website: null, commissionArrangement: null, createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z',
};

const meta = {
  component: VenueCard,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
  args: { onEdit: () => {} },
} satisfies Meta<typeof VenueCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NameOnly: Story = {
  args: { venue: minimalVenue },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('The Grand Ballroom')).toBeVisible();
  },
};

export const Full: Story = {
  args: { venue: fullVenue },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Kensington Palace')).toBeVisible();
    await expect(canvas.getByText('Parking')).toBeVisible();
    await expect(canvas.getByText('Access')).toBeVisible();
    await expect(canvas.getByText('Equipment')).toBeVisible();
  },
};
