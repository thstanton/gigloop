import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import DetailsCard from './DetailsCard';
import type { BookingLogisticsEntry } from '@/types/api';

const entry = (value: string, icon?: string): BookingLogisticsEntry => ({
  value,
  ...(icon && { icon }),
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

const allFieldsWithCustomIcons: Record<string, BookingLogisticsEntry> = {
  dressCode: entry('Black tie', 'star'),
  performanceSpace: entry('Grand ballroom, raised stage', 'briefcase'),
  foodProvided: entry('Full dinner provided', 'utensils'),
  greenRoom: entry('Room 12 beside the stage', 'users'),
  equipmentRequired: entry('PA system and two XLR inputs', 'volume-2'),
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
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText('Dress code')).toBeVisible();
    await expect(canvas.getByText('Black tie')).toBeVisible();
    await expect(canvas.getByText('Performance space')).toBeVisible();
    await expect(canvas.getByText('Food provided')).toBeVisible();
    await expect(canvas.getByText('Green room')).toBeVisible();
    await expect(canvas.getByText('Equipment required')).toBeVisible();
    const svgs = canvasElement.querySelectorAll('svg');
    await expect(svgs.length).toBeGreaterThanOrEqual(5);
  },
};

export const WithCustomIcons: Story = {
  args: { logistics: allFieldsWithCustomIcons },
};

export const Partial: Story = {
  args: { logistics: partialFields },
};

export const Empty: Story = {
  args: { logistics: null },
};
