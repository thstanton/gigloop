import { Meta, StoryObj } from '@storybook/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { expect } from 'storybook/test';
import { InlineVenueAdd } from './InlineVenueAdd';

const meta: Meta<typeof InlineVenueAdd> = {
  component: InlineVenueAdd,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    bookingId: 'b1',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('/api/contacts', () => HttpResponse.json([])),
      ],
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Venue')).toBeVisible();
    await expect(canvas.getByText('+ Add')).toBeVisible();
  },
};
