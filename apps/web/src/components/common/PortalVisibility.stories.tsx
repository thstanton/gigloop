import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from 'storybook/test';
import { PortalVisibility } from './PortalVisibility';

const meta: Meta<typeof PortalVisibility> = {
  title: 'Common/PortalVisibility',
  component: PortalVisibility,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof PortalVisibility>;

export const Visible: Story = { args: { visible: true } };

export const HiddenUntilSent: Story = { args: { visible: false, reason: 'until_sent' } };

export const HiddenVoided: Story = { args: { visible: false, reason: 'voided' } };

export const HiddenNotShared: Story = { args: { visible: false, reason: 'not_shared' } };

/** Primary use case: the visible badge and the muted hidden hint render the right copy. */
export const VisibleAndHidden: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <PortalVisibility visible={true} />
      <PortalVisibility visible={false} reason="until_sent" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Visible on Client Portal')).toBeInTheDocument();
    await expect(canvas.getByText('Not visible until sent')).toBeInTheDocument();
  },
};
