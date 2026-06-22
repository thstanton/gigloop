import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { StatusCoachingField } from './StatusCoachingField';
import type { BookingStatus } from '@/types/api';

// The create form's "starting status" coaching control (ADR-0053, #545). Forward statuses render
// as radio-semantic pills (Cancelled is not offered); selecting one reveals its CONTEXT-canon
// meaning below. Default selection is the musician's defaultBookingStatus — PROVISIONAL here.
function Harness({ initial = 'PROVISIONAL' as BookingStatus }) {
  const [value, setValue] = useState<BookingStatus>(initial);
  return (
    <div className="max-w-xl">
      <StatusCoachingField value={value} onChange={setValue} />
    </div>
  );
}

const meta: Meta<typeof StatusCoachingField> = {
  component: StatusCoachingField,
  tags: ['ai-generated'],
  render: () => <Harness />,
};

export default meta;
type Story = StoryObj<typeof StatusCoachingField>;

export const CoachesTheSelectedStatus: Story = {
  name: 'Coaches the selected status; Cancelled is not offered',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The five forward statuses render as radios; Cancelled is excluded as a creation status.
    await expect(canvas.getByRole('radio', { name: /Enquiry/ })).toBeVisible();
    await expect(canvas.getByRole('radio', { name: /Complete/ })).toBeVisible();
    await expect(canvas.queryByRole('radio', { name: /Cancelled/ })).toBeNull();

    // Default (PROVISIONAL) is pre-selected and its CONTEXT-canon meaning is shown.
    await expect(canvas.getByRole('radio', { name: /Provisional/ })).toBeChecked();
    await expect(canvas.getByText(/agreed your quote in principle/)).toBeVisible();

    // Selecting another status swaps the coaching copy to that status's meaning.
    await userEvent.click(canvas.getByRole('radio', { name: /Complete/ }));
    await expect(canvas.getByRole('radio', { name: /Complete/ })).toBeChecked();
    await expect(canvas.getByText(/Played and wrapped up/)).toBeVisible();
    await expect(canvas.queryByText(/agreed your quote in principle/)).toBeNull();
  },
};
