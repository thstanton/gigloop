import { useState } from 'react';
import { EllipsisVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SubLabel } from '@/components/common/SubLabel';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

export interface CardMenuItem {
  label: string;
  /** Optional helper line shown under the label, to disambiguate similar actions. */
  description?: string;
  icon?: React.ReactNode;
  onClick: () => void;
}

interface CardProps {
  title?: string;
  /** Primary header control (e.g. a labelled GhostButton). */
  action?: React.ReactNode;
  /** Secondary header actions, collapsed into a "…" overflow menu beside the primary action. */
  menu?: CardMenuItem[];
  className?: string;
  children: React.ReactNode;
}

/** Label + optional helper line, shared by the desktop dropdown and the mobile sheet. */
function MenuItemLabel({ item }: { item: CardMenuItem }) {
  if (!item.description) return <span>{item.label}</span>;
  return (
    <span className="flex flex-col gap-0.5">
      <span>{item.label}</span>
      <span className="text-xs font-normal text-muted-foreground">{item.description}</span>
    </span>
  );
}

/**
 * Header overflow menu: a vertical-ellipsis trigger that opens a dropdown on desktop and a
 * bottom sheet on mobile (mirroring RowActions' responsive pattern, without the row-level
 * confirmation / pending semantics).
 */
function CardMenu({ items, label }: { items: CardMenuItem[]; label?: string }) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      {/* Mobile: ellipsis opens a bottom sheet (40px tap target, icon stays 16px) */}
      <button
        type="button"
        aria-label="Actions"
        className="-mr-1.5 flex h-10 w-10 items-center justify-center text-muted transition-colors hover:text-foreground md:hidden"
        onClick={() => setSheetOpen(true)}
      >
        <EllipsisVertical size={16} />
      </button>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="border-t-0">
          <SheetTitle className={label ? undefined : 'sr-only'}>{label ?? 'Actions'}</SheetTitle>
          <div className={`space-y-1${label ? ' mt-3' : ''}`}>
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left hover:bg-accent"
                onClick={() => {
                  setSheetOpen(false);
                  item.onClick();
                }}
              >
                {item.icon}
                <MenuItemLabel item={item} />
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop: ellipsis dropdown */}
      <div className="hidden md:block">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="More actions"
            className="text-muted transition-colors hover:text-foreground"
          >
            <EllipsisVertical size={16} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {items.map((item) => (
              <DropdownMenuItem key={item.label} onClick={item.onClick}>
                {item.icon}
                <MenuItemLabel item={item} />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}

export function Card({ title, action, menu, className, children }: CardProps) {
  const hasMenu = !!menu && menu.length > 0;
  const hasHeader = !!title || !!action || hasMenu;

  return (
    <div className={cn('bg-background border border-border rounded-lg p-4', className)}>
      {hasHeader && (
        <div className="flex items-center justify-between mb-3">
          {title ? <SubLabel>{title}</SubLabel> : <span />}
          <div className="flex items-center gap-2">
            {action}
            {hasMenu && <CardMenu items={menu} label={title} />}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
