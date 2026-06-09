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
  dressCode: entry('Black tie', 'shirt'),
  performanceSpace: entry('Grand ballroom, raised stage', 'mic-2'),
  foodProvided: entry('Full dinner provided', 'utensils'),
  greenRoom: entry('Room 12 beside the stage', 'sofa'),
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

export const WithCustomFields: Story = {
  args: {
    logistics: {
      dressCode: entry('Black tie'),
      customField1: { value: 'Stage width 6m', label: 'Stage dimensions', shareWithBand: true, shareWithClient: false },
      customField2: { value: 'Parking bay 12', label: 'Parking', icon: 'briefcase', shareWithBand: false, shareWithClient: false },
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Dress code')).toBeVisible();
    await expect(canvas.getByText('Stage dimensions')).toBeVisible();
    await expect(canvas.getByText('Stage width 6m')).toBeVisible();
    await expect(canvas.getByText('Parking')).toBeVisible();
  },
};

export const Empty: Story = {
  args: { logistics: null },
};
