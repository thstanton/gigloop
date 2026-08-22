import { Button } from '@/components/ui/button';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from '@/components/ui/responsive-dialog';
import type { SpineId } from '@/features/bookings/builderCompleteness';

export function BuilderExitBackstopDialog({
  open,
  undone,
  onScrollTo,
  onClose,
  onExit,
}: {
  open: boolean;
  undone: Array<{ id: SpineId; label: string }>;
  onScrollTo: (id: SpineId) => void;
  onClose: () => void;
  onExit: () => void;
}) {
  return (
    <ResponsiveDialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>A few things still need setting up</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <ResponsiveDialogDescription className="mt-2">
          These sections are still empty. You can set them up now or come back later.
        </ResponsiveDialogDescription>
        <ul className="mt-4 space-y-2">
          {undone.map(({ id, label }) => (
            <li key={id} className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
              <span className="text-sm font-medium text-foreground">{label}</span>
              <Button size="sm" variant="outline" onClick={() => { onClose(); onScrollTo(id); }}>
                Set up
              </Button>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Keep editing</Button>
          <Button onClick={onExit}>Exit anyway</Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
