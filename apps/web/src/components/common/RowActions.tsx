import { useState } from 'react';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export interface RowAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'destructive';
  confirmation?: { title: string; description: string };
}

interface Props {
  actions: RowAction[];
  label?: string;
  sublabel?: string;
}

export function RowActions({ actions, label, sublabel }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmingAction, setConfirmingAction] = useState<RowAction | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const primaryAction = actions[0];
  const defaultActions = actions.filter((a) => a.variant !== 'destructive');
  const destructiveActions = actions.filter((a) => a.variant === 'destructive');

  function handleSheetAction(action: RowAction) {
    if (action.confirmation) {
      setConfirmingAction(action);
    } else {
      setSheetOpen(false);
      action.onClick();
    }
  }

  function handleConfirmInSheet() {
    confirmingAction?.onClick();
    setConfirmingAction(null);
    setSheetOpen(false);
  }

  function handleSheetOpenChange(open: boolean) {
    if (!open) setConfirmingAction(null);
    setSheetOpen(open);
  }

  function handleDropdownAction(action: RowAction) {
    if (action.confirmation) {
      setConfirmingAction(action);
      setDialogOpen(true);
    } else {
      action.onClick();
    }
  }

  function handleDialogConfirm() {
    confirmingAction?.onClick();
    setConfirmingAction(null);
    setDialogOpen(false);
  }

  function handleDialogOpenChange(open: boolean) {
    if (!open) setConfirmingAction(null);
    setDialogOpen(open);
  }

  return (
    <>
      {/* Mobile: ChevronRight tap target */}
      <button
        type="button"
        aria-label="Actions"
        className="text-muted transition-colors hover:text-foreground md:hidden"
        onClick={() => setSheetOpen(true)}
      >
        <ChevronRight size={16} />
      </button>

      {/* Mobile bottom sheet */}
      <Sheet open={sheetOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent side="bottom" className="border-t-0">
          <SheetTitle className={label ? undefined : 'sr-only'}>
            {label ?? 'Actions'}
          </SheetTitle>
          {label && sublabel && (
            <p className="text-sm text-muted-foreground">{sublabel}</p>
          )}
          {confirmingAction ? (
            <div className={`space-y-4 pb-2${label ? ' mt-3' : ''}`}>
              <p className="font-semibold">{confirmingAction.confirmation!.title}</p>
              <p className="text-sm text-muted-foreground">
                {confirmingAction.confirmation!.description}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setConfirmingAction(null)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleConfirmInSheet}>
                  Confirm
                </Button>
              </div>
            </div>
          ) : (
            <>
              {label && <Separator className="my-3" />}
              <div className="space-y-1">
              {defaultActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left hover:bg-accent"
                  onClick={() => handleSheetAction(action)}
                >
                  {action.icon}
                  <span>{action.label}</span>
                </button>
              ))}
              {destructiveActions.length > 0 && (
                <>
                  <Separator />
                  {destructiveActions.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-destructive hover:bg-accent"
                      onClick={() => handleSheetAction(action)}
                    >
                      {action.icon}
                      <span>{action.label}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Desktop: primary icon shortcut + overflow dropdown */}
      <div className="hidden items-center gap-1 md:flex">
        {primaryAction?.icon && (
          <button
            type="button"
            aria-label={primaryAction.label}
            className="text-muted transition-colors hover:text-foreground"
            onClick={() => handleDropdownAction(primaryAction)}
          >
            {primaryAction.icon}
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="More actions"
            className="text-muted transition-colors hover:text-foreground"
          >
            <MoreHorizontal size={16} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {defaultActions.map((action) => (
              <DropdownMenuItem key={action.label} onClick={() => handleDropdownAction(action)}>
                {action.icon}
                {action.label}
              </DropdownMenuItem>
            ))}
            {destructiveActions.length > 0 && (
              <>
                <DropdownMenuSeparator />
                {destructiveActions.map((action) => (
                  <DropdownMenuItem
                    key={action.label}
                    className="text-destructive focus:text-destructive"
                    onClick={() => handleDropdownAction(action)}
                  >
                    {action.icon}
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Desktop confirmation dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmingAction?.confirmation?.title}</DialogTitle>
            <DialogDescription>{confirmingAction?.confirmation?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setConfirmingAction(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDialogConfirm}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
