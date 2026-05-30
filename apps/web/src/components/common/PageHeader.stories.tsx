import type { Meta, StoryObj } from '@storybook/react';
import { MemoryRouter } from 'react-router-dom';
import { PageHeader } from './PageHeader';

const meta: Meta<typeof PageHeader> = {
  title: 'Common/PageHeader',
  component: PageHeader,
  tags: ['autodocs'],
  decorators: [(Story) => <MemoryRouter><Story /></MemoryRouter>],
};

export default meta;
type Story = StoryObj<typeof PageHeader>;

export const TitleOnly: Story = {
  args: { title: 'New booking' },
};

export const TitleAndBack: Story = {
  args: {
    title: 'Spring Wedding',
    backHref: '/admin/bookings',
    backLabel: 'Bookings',
  },
};

export const TitleBackAndAction: Story = {
  args: {
    title: 'Jane Smith',
    backHref: '/admin/contacts',
    backLabel: 'Contacts',
    action: (
      <button className="border border-border rounded px-3 py-1.5 text-sm text-foreground hover:bg-surface transition-colors">
        Edit
      </button>
    ),
  },
};
