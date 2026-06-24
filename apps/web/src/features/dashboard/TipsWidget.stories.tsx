import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import { TipsWidget } from './TipsWidget';
import type { TipDisplay } from './tipEngine';

const sampleTip: TipDisplay = {
  id: 'home-address-missing',
  text: 'Add your home address so GigMan can show travel times to venues',
  href: '/admin/settings',
};

/** Simulates the container: dismissing the tip drops it to null (no more eligible). */
function StatefulTipsWidget() {
  const [tip, setTip] = useState<TipDisplay | null>(sampleTip);
  return <TipsWidget tip={tip} onDismiss={() => setTip(null)} />;
}

const meta = {
  title: 'Dashboard/TipsWidget',
  component: TipsWidget,
  tags: ['autodocs'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
} satisfies Meta<typeof TipsWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One eligible tip. */
export const WithTip: Story = {
  args: { tip: sampleTip, onDismiss: () => {} },
};

/** No eligible tip — the widget renders nothing. */
export const Empty: Story = {
  args: { tip: null, onDismiss: () => {} },
};

/** Eligible tip renders → dismiss hides it → nothing remains. */
export const DismissHidesIt: Story = {
  args: { tip: sampleTip, onDismiss: () => {} },
  render: () => <StatefulTipsWidget />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: /add your home address/i })).toBeVisible();

    await userEvent.click(canvas.getByRole('button', { name: /dismiss tip/i }));
    await expect(canvas.queryByRole('link', { name: /add your home address/i })).toBeNull();
  },
};
