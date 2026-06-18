import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from './responsive-dialog';

function renderDialog() {
  render(
    <ResponsiveDialog open>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Confirm</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
      </ResponsiveDialogContent>
    </ResponsiveDialog>,
  );
  return document.querySelector('[role="dialog"]');
}

afterEach(cleanup);

describe('ResponsiveDialog (#470)', () => {
  // The switch is pure CSS (one Radix instance, responsive Tailwind variants),
  // so jsdom can't tell us which layout *applies* at a given width — only that
  // both rule sets are present. We assert the content carries the mobile
  // bottom-sheet base AND the `md:` centred-dialog overrides; the actual
  // breakpoint behaviour is verified visually in the Storybook viewport toggle.
  it('renders a single dialog instance', () => {
    renderDialog();
    expect(screen.getByText('Confirm')).toBeVisible();
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  });

  it('carries the mobile bottom-sheet base classes', () => {
    const content = renderDialog();
    expect(content?.className).toContain('bottom-0');
    expect(content?.className).toContain('data-[state=open]:slide-in-from-bottom');
  });

  it('carries the desktop centred-dialog md: overrides (regression guard)', () => {
    const content = renderDialog();
    expect(content?.className).toContain('md:left-[50%]');
    expect(content?.className).toContain('md:top-[50%]');
    expect(content?.className).toContain('md:rounded-lg');
  });
});
