import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import BookingDetailTabs from './BookingDetailTabs';

const ChecklistContent = () => (
  <div data-testid="checklist-content">Checklist content</div>
);
const OnTheDayContent = () => (
  <div data-testid="on-the-day-content">On the Day content</div>
);
const InfoContent = () => (
  <div data-testid="info-content">Info content</div>
);

const meta = {
  component: BookingDetailTabs,
  tags: ['ai-generated'],
  args: {
    defaultTab: 'checklist',
    checklist: <ChecklistContent />,
    onTheDay: <OnTheDayContent />,
    info: <InfoContent />,
  },
} satisfies Meta<typeof BookingDetailTabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DefaultChecklist: Story = {
  args: { defaultTab: 'checklist' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Checklist')).toBeVisible();
    await expect(canvas.getByText('On the Day')).toBeVisible();
    await expect(canvas.getByText('Info')).toBeVisible();
    await expect(canvas.getByTestId('checklist-content')).toBeVisible();
  },
};

export const TabSwitching: Story = {
  args: { defaultTab: 'checklist' },
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId('checklist-content')).toBeVisible();

    await userEvent.click(canvas.getByText('On the Day'));
    await expect(canvas.getByTestId('on-the-day-content')).toBeVisible();

    await userEvent.click(canvas.getByText('Info'));
    await expect(canvas.getByTestId('info-content')).toBeVisible();

    await userEvent.click(canvas.getByText('Checklist'));
    await expect(canvas.getByTestId('checklist-content')).toBeVisible();
  },
};

export const DefaultOnTheDay: Story = {
  args: { defaultTab: 'onTheDay' },
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId('on-the-day-content')).toBeVisible();
  },
};

export const DefaultInfo: Story = {
  args: { defaultTab: 'info' },
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId('info-content')).toBeVisible();
  },
};
