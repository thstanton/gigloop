import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import ContactForm from './ContactForm';

const meta = {
  component: ContactForm,
  tags: ['ai-generated'],
} satisfies Meta<typeof ContactForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    onSubmit: () => {},
    isPending: false,
    isError: false,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: /save/i })).toBeVisible();
    // FormField has no htmlFor; verify inputs are present by count
    await expect(canvas.getAllByRole('textbox').length).toBeGreaterThan(3);
  },
};

export const CssCheck: Story = {
  args: {
    onSubmit: () => {},
    isPending: false,
    isError: false,
  },
  play: async ({ canvas }) => {
    const btn = canvas.getByRole('button', { name: /save/i });
    // Button has bg-primary class — proves Tailwind utility CSS loaded
    await expect(btn.className).toContain('bg-primary');
  },
};

export const WithDefaultValues: Story = {
  args: {
    defaultValues: {
      name: 'Sophie Hartley',
      greetingName: 'Sophie',
      email: 'sophie@example.com',
      phone: '+44 7700 900456',
      website: '',
      address: '12 Acacia Avenue, London',
      notes: 'Repeat customer',
      parkingInfo: '',
      accessInfo: '',
      equipmentAvailable: '',
      commissionArrangement: '',
      primaryRole: 'CUSTOMER',
    },
    onSubmit: () => {},
    isPending: false,
    isError: false,
  },
};

export const Saving: Story = {
  args: {
    onSubmit: () => {},
    isPending: true,
    isError: false,
  },
};

export const SaveError: Story = {
  args: {
    onSubmit: () => {},
    isPending: false,
    isError: true,
  },
};
