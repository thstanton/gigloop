import type { BookingStatus } from '@/types/api';

/** The four statuses that make up the active pipeline (in-flight work). */
export const ACTIVE_PIPELINE_STATUSES: BookingStatus[] = [
  'ENQUIRY',
  'PROVISIONAL',
  'CONFIRMED',
  'READY',
];

/** A tab value — either the synthetic 'ACTIVE' aggregate or an individual status. */
export type ListTab = BookingStatus | 'ACTIVE';

export interface ListScopeParams {
  /**
   * The explicitly selected status tab from the URL (?status=).
   * Undefined means no tab is selected (resting state → Active pipeline).
   */
  tab?: BookingStatus;
  /**
   * The active search query (?q=). Not yet exposed in the UI (slice 2),
   * but the lift-to-all-statuses branch is built and tested here.
   */
  q?: string;
}

export interface ListScope {
  /** Statuses to send to the API. Empty array = no filter (all statuses returned). */
  effectiveStatuses: BookingStatus[];
  /** Which tab to highlight. Null = lifted/neutral state (search active, no explicit tab). */
  highlightedTab: ListTab | null;
}

/**
 * Resolves the effective API status filter and the highlighted tab from current
 * URL params. Three branches:
 *
 * 1. Explicit tab selected → constrain to that status, highlight it.
 * 2. Search active, no explicit tab → lift to all statuses (no constraint), no highlight.
 * 3. Resting (no tab, no search) → active pipeline, highlight 'ACTIVE'.
 *
 * Explicit tab always wins over search lifting (per ADR-0041 §3).
 */
export function resolveListScope(params: ListScopeParams): ListScope {
  const { tab, q } = params;

  if (tab !== undefined) {
    return { effectiveStatuses: [tab], highlightedTab: tab };
  }

  if (q && q.trim().length >= 2) {
    return { effectiveStatuses: [], highlightedTab: null };
  }

  return { effectiveStatuses: ACTIVE_PIPELINE_STATUSES, highlightedTab: 'ACTIVE' };
}
