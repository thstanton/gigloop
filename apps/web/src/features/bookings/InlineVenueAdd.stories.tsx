import { Meta, StoryObj } from '@storybook/react';
import { MemoryRouter } from 'react-router-dom';
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
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Venue')).toBeVisible();
    await expect(canvas.getByText('No venue yet')).toBeVisible();
    await expect(canvas.getByText('Add a venue to include address and travel time in your booking.')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Add venue' })).toBeVisible();
  },
};
