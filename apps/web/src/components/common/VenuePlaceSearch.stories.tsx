import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { VenuePlaceSearch } from './VenuePlaceSearch';

const emptyValue = {
  name: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  county: '',
  postcode: '',
  country: 'GB',
  latitude: null,
  longitude: null,
  placeId: null,
};

const meta = {
  title: 'Common/VenuePlaceSearch',
  component: VenuePlaceSearch,
  tags: ['autodocs'],
  args: {
    value: emptyValue,
    onChange: () => {},
  },
} satisfies Meta<typeof VenuePlaceSearch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithSelection: Story = {
  args: {
    value: {
      name: 'Royal Albert Hall',
      addressLine1: 'Kensington Gore',
      addressLine2: '',
      city: 'London',
      county: 'Greater London',
      postcode: 'SW7 2AP',
      country: 'GB',
      latitude: 51.5009,
      longitude: -0.1774,
      placeId: 'ChIJmfGh3_kEdkgRqcAOdnMVbXQ',
    },
  },
  play: async ({ canvas }) => {
    // After selection, venue name appears in the search input and address fields are shown.
    await expect(canvas.getByDisplayValue('Royal Albert Hall')).toBeVisible();
    await expect(canvas.getByDisplayValue('Kensington Gore')).toBeVisible();
    await expect(canvas.getByDisplayValue('London')).toBeVisible();
    await expect(canvas.getByDisplayValue('SW7 2AP')).toBeVisible();
  },
};
