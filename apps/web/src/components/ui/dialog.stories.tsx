import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { within } from 'storybook/test';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './dialog';
import { Button } from './button';

function BasicDialog({ open = true }: { open?: boolean }) {
  return (
    <Dialog open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm action</DialogTitle>
          <DialogDescription>This action cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button variant="destructive">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const meta = {
  component: BasicDialog,
  tags: ['ai-generated'],
} satisfies Meta<typeof BasicDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: { open: true },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText('Confirm action')).toBeVisible();
    await expect(body.getByRole('button', { name: /delete/i })).toBeVisible();
  },
};

export const Closed: Story = {
  args: { open: false },
};
