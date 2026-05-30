import type { Meta, StoryObj } from '@storybook/react';
import { PageSection } from './PageSection';

const meta: Meta<typeof PageSection> = {
  title: 'Common/PageSection',
  component: PageSection,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof PageSection>;

export const TitleOnly: Story = {
  args: {
    title: 'Public profile',
  },
};

export const WithDescription: Story = {
  args: {
    title: 'Notifications',
    description: 'Choose when and how you receive updates about your bookings.',
  },
};

export const WithAction: Story = {
  args: {
    title: 'Team members',
    children: (
      <button className="text-xs text-primary hover:text-primary/80 transition-colors">
        + Invite
      </button>
    ),
  },
};
