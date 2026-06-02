import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { AddressAutocomplete } from './AddressAutocomplete';

const emptyAddress = {
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
  title: 'Common/AddressAutocomplete',
  component: AddressAutocomplete,
  tags: ['autodocs'],
  args: {
    value: emptyAddress,
    onChange: () => {},
  },
} satisfies Meta<typeof AddressAutocomplete>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithSelection: Story = {
  args: {
    value: {
      addressLine1: '10 Downing Street',
      addressLine2: '',
      city: 'London',
      county: 'Greater London',
      postcode: 'SW1A 2AA',
      country: 'GB',
      latitude: 51.5034,
      longitude: -0.1276,
      placeId: 'ChIJdd4hrwug2EcRmSrV3Vo6llI',
    },
  },
  play: async ({ canvas }) => {
    // After selection, editable input fields are shown with parsed values.
    await expect((canvas.getByDisplayValue('10 Downing Street'))).toBeVisible();
    await expect((canvas.getByDisplayValue('London'))).toBeVisible();
    await expect((canvas.getByDisplayValue('SW1A 2AA'))).toBeVisible();
  },
};
