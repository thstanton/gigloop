import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CommandPalette } from '@/components/common/CommandPalette';
import { useSearch } from '@/lib/hooks/useSearch';
import { QUICK_ACTIONS, QUICK_ACTION_COMMANDS, PINNED_QUICK_ACTIONS, type QuickAction } from '@/lib/constants';
import { isEnabled } from '@/lib/featureFlags';
import { useAppearance } from '@/lib/hooks/useAppearance';
import { getRecentlyViewed } from '@/lib/recentlyViewed';
import type { SearchResult } from '@/types/api';

interface GlobalCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** ⌘K (mac) / Ctrl-K (win/linux) — the palette toggle chord (ADR-0067 §7). */
function isPaletteShortcut(event: KeyboardEvent): boolean {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
}

/**
 * Container for the global command palette (ADR-0067 §7): owns the query text, runs the debounced
 * `GET /search` (via {@link useSearch}), and navigates to a chosen result's `url` before closing.
 * The presentational `CommandPalette` stays fetch-free; this is where the data and routing live.
 * Rendered only when the feature flag is on (the gate is in `AppShell`), so the ⌘K/Ctrl-K listener
 * it registers is likewise dark until go-live.
 */
export function GlobalCommandPalette({ open, onOpenChange }: GlobalCommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<SearchResult[]>([]);
  const navigate = useNavigate();
  const { results, isLoading } = useSearch(query);
  const { resolved, setPreference } = useAppearance();

  // Refresh the recently-viewed list each time the palette opens (it changes as pages are visited).
  useEffect(() => {
    if (open) setRecent(getRecentlyViewed());
  }, [open]);

  // Closing always resets the query, so the palette reopens fresh.
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) setQuery('');
      onOpenChange(next);
    },
    [onOpenChange],
  );

  // The toggle chord works from anywhere in the app.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isPaletteShortcut(event)) return;
      event.preventDefault();
      handleOpenChange(!open);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, handleOpenChange]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      navigate(result.url);
      handleOpenChange(false);
    },
    [navigate, handleOpenChange],
  );

  const handleSelectAction = useCallback(
    (action: QuickAction) => {
      if (action.kind === 'navigate') {
        navigate(action.route);
      } else {
        // 'toggle-appearance' is the only command: flip the *resolved* appearance.
        setPreference(resolved === 'dark' ? 'light' : 'dark');
      }
      handleOpenChange(false);
    },
    [navigate, handleOpenChange, resolved, setPreference],
  );

  const actions = useMemo(
    () => [...QUICK_ACTIONS, ...QUICK_ACTION_COMMANDS.filter((row) => !row.flag || isEnabled(row.flag))],
    [],
  );

  return (
    <CommandPalette
      open={open}
      onOpenChange={handleOpenChange}
      query={query}
      onQueryChange={setQuery}
      results={results}
      isLoading={isLoading}
      onSelectResult={handleSelect}
      actions={actions}
      onSelectAction={handleSelectAction}
      recent={recent}
      pinnedActions={PINNED_QUICK_ACTIONS}
    />
  );
}
