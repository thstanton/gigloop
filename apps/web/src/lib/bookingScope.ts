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
  /** The active search query (?q=). Two or more characters lifts to all statuses. */
  q?: string;
  /** The active event-type filter (?eventType=). Lifts to all statuses from resting state. */
  eventType?: string;
}

export interface ListScope {
  /** Statuses to send to the API. Empty array = no filter (all statuses returned). */
  effectiveStatuses: BookingStatus[];
  /** Which tab to highlight. Null = lifted/neutral state (search or filter active, no explicit tab). */
  highlightedTab: ListTab | null;
}

/**
 * Resolves the effective API status filter and the highlighted tab from current
 * URL params. Three branches:
 *
 * 1. Explicit tab selected → constrain to that status, highlight it.
 * 2. Search or filter active, no explicit tab → lift to all statuses, no highlight.
 * 3. Resting (no tab, no search, no filter) → active pipeline, highlight 'ACTIVE'.
 *
 * Explicit tab always wins over lifting (per ADR-0041 §3).
 */
export function resolveListScope(params: ListScopeParams): ListScope {
  const { tab, q, eventType } = params;

  if (tab !== undefined) {
    return { effectiveStatuses: [tab], highlightedTab: tab };
  }

  const searchActive = q && q.trim().length >= 2;
  const filterActive = !!eventType;

  if (searchActive || filterActive) {
    return { effectiveStatuses: [], highlightedTab: null };
  }

  return { effectiveStatuses: ACTIVE_PIPELINE_STATUSES, highlightedTab: 'ACTIVE' };
}
