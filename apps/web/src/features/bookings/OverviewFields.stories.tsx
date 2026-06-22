import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { OverviewFields, type OverviewFieldsValue } from './OverviewFields';

const EMPTY: OverviewFieldsValue = {
  eventType: 'WEDDING',
  date: '',
  fee: '',
  title: '',
  seriesMode: 'none',
  seriesId: null,
  newSeriesLabel: '',
};

// Controlled harness mirroring the create-form regime: RHF owns the value, the core bubbles
// the full next value on every edit. The spy lets stories assert what bubbled.
function Harness({ onChange, initial }: { onChange: (v: OverviewFieldsValue) => void; initial?: OverviewFieldsValue }) {
  const [value, setValue] = useState<OverviewFieldsValue>(initial ?? EMPTY);
  return (
    <OverviewFields
      value={value}
      onChange={(next) => { setValue(next); onChange(next); }}
      series={[
        { id: 's1', label: 'Summer Weddings 2026' },
        { id: 's2', label: 'Hotel Corporate Events' },
      ]}
    />
  );
}

const meta: Meta<typeof OverviewFields> = {
  component: OverviewFields,
  tags: ['ai-generated'],
  args: { onChange: fn() },
  render: (args) => <Harness onChange={args.onChange} />,
};

export default meta;
type Story = StoryObj<typeof OverviewFields>;

export const FieldsRender: Story = {
  name: 'Identity fields render; status is not among them',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText('Event type')).toBeVisible();
    await expect(canvas.getByLabelText('Fee')).toBeVisible();
    await expect(canvas.getByLabelText('Title')).toBeVisible();
    await expect(canvas.queryByLabelText(/status/i)).toBeNull();
  },
};

export const EditTitleBubbles: Story = {
  name: 'Create-mode: editing the title bubbles the full value',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Title'), 'Smith Wedding');
    await expect(args.onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Smith Wedding' }),
    );
  },
};

export const NewSeriesBubbles: Story = {
  name: 'Create-mode: new series label bubbles { seriesMode: new, newSeriesLabel }',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /new series/i }));
    await userEvent.type(canvas.getByLabelText('Series label'), 'Hotel Grand — 2026');
    await expect(args.onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ seriesMode: 'new', newSeriesLabel: 'Hotel Grand — 2026' }),
    );
  },
};

export const ExistingSeriesBubbles: Story = {
  name: 'Create-mode: picking an existing series bubbles its id',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /existing series/i }));
    await userEvent.click(canvas.getByLabelText('Series'));
    const option = await within(canvasElement.ownerDocument.body).findByText('Summer Weddings 2026');
    await userEvent.click(option);
    await expect(args.onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ seriesMode: 'existing', seriesId: 's1' }),
    );
  },
};
