import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from './responsive-dialog';
import { Button } from './button';

function ConfirmDialog({ open = true }: { open?: boolean }) {
  return (
    <ResponsiveDialog open={open}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Delete booking</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            This action cannot be undone.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogFooter className="mt-4">
          <Button variant="outline">Cancel</Button>
          <Button variant="destructive">Delete</Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

const meta = {
  component: ConfirmDialog,
  tags: ['ai-generated'],
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: { open: true },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText('Delete booking')).toBeVisible();
    await expect(body.getByRole('button', { name: /delete/i })).toBeVisible();

    // Regression guard for #470: the content must carry both the mobile
    // bottom-sheet base (`bottom-0`) and the desktop `md:` centred-dialog
    // overrides. Use the Storybook viewport toggle to see the switch animate.
    const content = canvasElement.ownerDocument.body.querySelector('[role="dialog"]');
    expect(content?.className).toContain('bottom-0');
    expect(content?.className).toContain('md:left-[50%]');
  },
};

export const Closed: Story = {
  args: { open: false },
};
