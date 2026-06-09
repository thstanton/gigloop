import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import DetailsCard from './DetailsCard';
import type { BookingLogisticsEntry } from '@/types/api';

const entry = (value: string): BookingLogisticsEntry => ({
  value,
  shareWithBand: false,
  shareWithClient: false,
});

const allFields: Record<string, BookingLogisticsEntry> = {
  dressCode: entry('Black tie'),
  performanceSpace: entry('Grand ballroom, raised stage'),
  foodProvided: entry('Full dinner provided'),
  greenRoom: entry('Room 12 beside the stage'),
  equipmentRequired: entry('PA system and two XLR inputs'),
};

const partialFields: Record<string, BookingLogisticsEntry> = {
  dressCode: entry('Smart casual'),
  foodProvided: entry('Buffet during break'),
};

const meta = {
  component: DetailsCard,
  tags: ['ai-generated'],
  args: { onEdit: () => {} },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
} satisfies Meta<typeof DetailsCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllFields: Story = {
  args: { logistics: allFields },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Dress code')).toBeVisible();
    await expect(canvas.getByText('Black tie')).toBeVisible();
    await expect(canvas.getByText('Performance space')).toBeVisible();
    await expect(canvas.getByText('Food provided')).toBeVisible();
    await expect(canvas.getByText('Green room')).toBeVisible();
    await expect(canvas.getByText('Equipment required')).toBeVisible();
  },
};

export const Partial: Story = {
  args: { logistics: partialFields },
};

export const Empty: Story = {
  args: { logistics: null },
};
