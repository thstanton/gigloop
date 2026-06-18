import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from './dialog';

/**
 * A confirmation dialog that renders as a **bottom Sheet on mobile** and a
 * **centred Dialog on desktop**, switched purely with CSS at the `md` (768px)
 * breakpoint.
 *
 * No JS viewport detection is needed: `Dialog` and `Sheet` are both built on
 * `@radix-ui/react-dialog`, so the only thing that differs between them is the
 * Content element's position/animation classes. We render one Radix instance
 * and let responsive Tailwind variants do the rest — one focus scope, one
 * scroll-lock, aria auto-wired, no first-render flash.
 *
 * Scope: **confirmations and short quick-actions only** (per ADR-0012). Data
 * entry surfaces (contact creation, etc.) use inline forms / right-side Sheets.
 */
const ResponsiveDialog = Dialog;

const ResponsiveDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed z-50 bg-background p-6 shadow-lg transition ease-in-out',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:duration-300 data-[state=open]:duration-500',
        // Mobile (base): bottom sheet — full width, pinned to the bottom edge.
        'inset-x-0 bottom-0 border-t',
        'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
        // Desktop (md+): centred dialog — overrides the bottom-sheet position.
        'md:inset-x-auto md:bottom-auto md:left-[50%] md:top-[50%]',
        'md:w-full md:max-w-lg md:translate-x-[-50%] md:translate-y-[-50%]',
        'md:rounded-lg md:border md:duration-200',
        'md:data-[state=closed]:slide-out-to-left-1/2 md:data-[state=closed]:slide-out-to-top-[48%]',
        'md:data-[state=open]:slide-in-from-left-1/2 md:data-[state=open]:slide-in-from-top-[48%]',
        'md:data-[state=closed]:zoom-out-95 md:data-[state=open]:zoom-in-95',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
ResponsiveDialogContent.displayName = 'ResponsiveDialogContent';

// Header / Footer / Title / Description are presentation-identical between
// Dialog and Sheet, so the Dialog versions serve both viewports.
const ResponsiveDialogHeader = DialogHeader;
const ResponsiveDialogFooter = DialogFooter;
const ResponsiveDialogTitle = DialogTitle;
const ResponsiveDialogDescription = DialogDescription;

export {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogFooter,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
};
