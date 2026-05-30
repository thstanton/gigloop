import type { Meta, StoryObj } from '@storybook/react';
import { SubLabel } from './SubLabel';

const meta: Meta<typeof SubLabel> = {
  title: 'Common/SubLabel',
  component: SubLabel,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SubLabel>;

export const Default: Story = {
  args: {
    children: 'Key moments',
  },
};

export const InContext: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <SubLabel className="mb-2">Key moments</SubLabel>
        <p className="text-sm text-muted">First dance, speeches, cake cutting</p>
      </div>
      <div>
        <SubLabel className="mb-2">General requests</SubLabel>
        <p className="text-sm text-muted">Jazz, Motown, 80s pop</p>
      </div>
      <div>
        <SubLabel className="mb-2">Notes</SubLabel>
        <p className="text-sm text-muted">Please keep volume low during dinner.</p>
      </div>
    </div>
  ),
};
