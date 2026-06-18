import { useState, useEffect } from 'react';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export interface RowAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'destructive';
  confirmation?: { title: string; description: string };
  isPending?: boolean;
}

interface Props {
  actions: RowAction[];
  label?: string;
  sublabel?: string;
}

export function RowActions({ actions, label, sublabel }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmingLabel, setConfirmingLabel] = useState<string | null>(null);
  const [confirmFired, setConfirmFired] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const primaryAction = actions[0];
  const defaultActions = actions.filter((a) => a.variant !== 'destructive');
  const destructiveActions = actions.filter((a) => a.variant === 'destructive');

  // Derive current action from label so isPending stays fresh across renders
  const confirmingAction = confirmingLabel
    ? (actions.find((a) => a.label === confirmingLabel) ?? null)
    : null;
  const isConfirmPending = confirmingAction?.isPending ?? false;

  // Close when a pending action completes (or errors)
  useEffect(() => {
    if (confirmFired && !isConfirmPending) {
      setConfirmingLabel(null);
      setConfirmFired(false);
      setSheetOpen(false);
      setDialogOpen(false);
    }
  }, [confirmFired, isConfirmPending]);

  function handleSheetAction(action: RowAction) {
    if (action.isPending) return;
    if (action.confirmation) {
      setConfirmingLabel(action.label);
      setConfirmFired(false);
    } else {
      setSheetOpen(false);
      action.onClick();
    }
  }

  function handleConfirmInSheet() {
    if (!confirmingAction) return;
    confirmingAction.onClick();
    if (confirmingAction.isPending !== undefined) {
      setConfirmFired(true);
    } else {
      setConfirmingLabel(null);
      setSheetOpen(false);
    }
  }

  function handleSheetOpenChange(open: boolean) {
    if (!open && isConfirmPending) return;
    if (!open) {
      setConfirmingLabel(null);
      setConfirmFired(false);
    }
    setSheetOpen(open);
  }

  function handleDropdownAction(action: RowAction) {
    if (action.isPending) return;
    if (action.confirmation) {
      setConfirmingLabel(action.label);
      setConfirmFired(false);
      setDialogOpen(true);
    } else {
      action.onClick();
    }
  }

  function handleDialogConfirm() {
    if (!confirmingAction) return;
    confirmingAction.onClick();
    if (confirmingAction.isPending !== undefined) {
      setConfirmFired(true);
    } else {
      setConfirmingLabel(null);
      setDialogOpen(false);
    }
  }

  function handleDialogOpenChange(open: boolean) {
    if (!open && isConfirmPending) return;
    if (!open) {
      setConfirmingLabel(null);
      setConfirmFired(false);
    }
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
                <Button
                  variant="outline"
                  disabled={isConfirmPending}
                  onClick={() => {
                    setConfirmingLabel(null);
                    setConfirmFired(false);
                  }}
                >
                  Cancel
                </Button>
                <Button variant="destructive" disabled={isConfirmPending} onClick={handleConfirmInSheet}>
                  {isConfirmPending ? '…' : 'Confirm'}
                </Button>
              </div>
            </div>
          ) : (
            <div className={`space-y-1${label ? ' mt-3' : ''}`}>
              {defaultActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  disabled={action.isPending}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => handleSheetAction(action)}
                >
                  {action.icon}
                  <span>{action.isPending ? '…' : action.label}</span>
                </button>
              ))}
              {destructiveActions.length > 0 && (
                <>
                  <Separator />
                  {destructiveActions.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      disabled={action.isPending}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-destructive hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => handleSheetAction(action)}
                    >
                      {action.icon}
                      <span>{action.isPending ? '…' : action.label}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Desktop: primary icon shortcut + overflow dropdown */}
      <div className="hidden items-center gap-1 md:flex">
        {primaryAction?.icon && (
          <button
            type="button"
            aria-label={primaryAction.label}
            disabled={primaryAction.isPending}
            className="text-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
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
              <DropdownMenuItem
                key={action.label}
                disabled={action.isPending}
                onClick={() => handleDropdownAction(action)}
              >
                {action.icon}
                {action.isPending ? '…' : action.label}
              </DropdownMenuItem>
            ))}
            {destructiveActions.length > 0 && (
              <>
                <DropdownMenuSeparator />
                {destructiveActions.map((action) => (
                  <DropdownMenuItem
                    key={action.label}
                    disabled={action.isPending}
                    className="text-destructive focus:text-destructive"
                    onClick={() => handleDropdownAction(action)}
                  >
                    {action.icon}
                    {action.isPending ? '…' : action.label}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Desktop confirmation sheet */}
      <Sheet open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>{confirmingAction?.confirmation?.title}</SheetTitle>
            <SheetDescription>{confirmingAction?.confirmation?.description}</SheetDescription>
          </SheetHeader>
          <SheetFooter className="mt-4">
            <Button
              variant="outline"
              disabled={isConfirmPending}
              onClick={() => {
                setDialogOpen(false);
                setConfirmingLabel(null);
                setConfirmFired(false);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" disabled={isConfirmPending} onClick={handleDialogConfirm}>
              {isConfirmPending ? '…' : 'Confirm'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
