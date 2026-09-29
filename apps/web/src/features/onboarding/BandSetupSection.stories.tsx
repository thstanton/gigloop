import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';
import { BandSetupSection, type BandSetupAnswer } from './BandSetupSection';
import { emptyLineupFormValues, type LineupFormValues } from '@/features/packages/LineupForm';

const meta = {
  component: BandSetupSection,
  tags: ['ai-generated'],
  args: {
    answer: null,
    onAnswerChange: () => {},
    lineup: {
      lineups: [],
      lineupsLoading: false,
      selectedLineupId: null,
      onSelectLineup: () => {},
      createNewLineup: false,
      onCreateNewLineup: () => {},
      onUseExistingLineup: () => {},
      lineupDraft: emptyLineupFormValues(),
      onLineupDraftChange: () => {},
    },
  },
} satisfies Meta<typeof BandSetupSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unanswered: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Who's on stage?")).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Just me' })).toHaveAttribute('aria-pressed', 'false');
    await expect(canvas.getByRole('button', { name: 'I play with other musicians' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  },
};

export const Solo: Story = {
  args: { answer: 'solo' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Just me' })).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByText("We won't show band checklist goals on your bookings.")).toBeVisible();
  },
};

function BandWithLineupHarness() {
  const [answer, setAnswer] = useState<BandSetupAnswer>('band');
  const [draft, setDraft] = useState<LineupFormValues>({
    label: 'My five-piece',
    slots: [
      { key: 'vocals', role: 'Vocals', order: 0 },
      { key: 'sax', role: 'Sax', order: 1 },
      { key: 'keys', role: 'Keys', order: 2 },
      { key: 'bass', role: 'Bass', order: 3 },
      { key: 'drums', role: 'Drums', order: 4 },
    ],
  });

  return (
    <BandSetupSection
      answer={answer}
      onAnswerChange={setAnswer}
      lineup={{
        lineups: [],
        lineupsLoading: false,
        selectedLineupId: null,
        onSelectLineup: () => {},
        createNewLineup: true,
        onCreateNewLineup: () => {},
        onUseExistingLineup: () => {},
        lineupDraft: draft,
        onLineupDraftChange: (patch) => setDraft((current) => ({ ...current, ...patch })),
      }}
    />
  );
}

export const BandWithALineup: Story = {
  render: () => <BandWithLineupHarness />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'I play with other musicians' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(canvas.getByDisplayValue('My five-piece')).toBeVisible();
    await expect(canvas.getByDisplayValue('Sax')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: '+ Add part' }));
    await userEvent.type(canvas.getAllByPlaceholderText('e.g. Saxophone')[5], 'Violin');
    await expect(canvas.getByDisplayValue('Violin')).toBeVisible();
  },
};
