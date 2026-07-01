// The single portal-visibility authority (ADR-0054). A deterministic, I/O-free module that
// answers "is concern X visible on the client portal right now, and if not, why?". Both consumers
// — the client portal renderer (portal.service) and the admin indicator (bookings.service) —
// read their verdict from here, so they cannot disagree.
//
// This module is intentionally dependency-free (no NestJS, no Prisma, no repos): it is a pure
// function file imported by both services, which avoids any DI/import cycle between the portal and
// bookings modules.
//
// Slice 1 (#578) seeds the contract and music-form concerns. The booking-CANCELLED gate and the
// UPLOAD rule land in #579 (below); per-document verdicts in #580.

export type PortalVisibilityReason = 'until_sent' | 'voided' | 'not_shared' | 'cancelled';

export interface PortalVisibilityVerdict {
  visible: boolean;
  reason?: PortalVisibilityReason;
}

export type ContractStatus = 'DRAFT' | 'SENT' | 'SIGNED' | 'VOID';

/**
 * Contract-concern visibility. Returns null when there is no contract yet — the contract is not a
 * live portal concern, so the admin shows no indicator (the ContractCard's "No contracts yet"
 * state). A DRAFT is prepared-but-not-sent; SENT/SIGNED are what the client can act on / download;
 * VOID has been superseded.
 *
 * `bookingCancelled` is the **outermost** gate (#579): cancelling a booking does not void its
 * contract, so without this the portal would keep the signing CTA / signed-download live on a
 * cancelled gig. When the booking is cancelled the whole contract concern is hidden regardless of
 * contract status — but only if a contract exists (no contract → still no concern → null).
 */
export function resolveContractVisibility(
  contractStatus: ContractStatus | null,
  bookingCancelled = false,
): PortalVisibilityVerdict | null {
  if (contractStatus === null) return null;
  if (bookingCancelled) return { visible: false, reason: 'cancelled' };
  switch (contractStatus) {
    case 'SENT':
    case 'SIGNED':
      return { visible: true };
    case 'DRAFT':
      return { visible: false, reason: 'until_sent' };
    case 'VOID':
      return { visible: false, reason: 'voided' };
  }
}

/**
 * Type-level portal gate for a stored Document (#579). Owns only the UPLOAD rule here: musician
 * uploads (an agent contract, a venue rider) are private paperwork, never shown to the client
 * (`not_shared`). CONTRACT and INVOICE documents carry a further *stateful* gate (active-contract
 * id, invoice delivery status) that still lives in portal.service's `isPortalVisibleDocument`; the
 * full per-document authority verdict lands in #580. Returns null when the type is not gated at
 * this level (i.e. defer to the stateful rules).
 */
export function resolveUploadDocumentVisibility(docType: string): PortalVisibilityVerdict | null {
  return docType === 'UPLOAD' ? { visible: false, reason: 'not_shared' } : null;
}

/**
 * Music-form-concern visibility. Presence of the config is the on/off truth (ADR-0046): on → the
 * form is live on the portal the instant it is turned on (#533 has no draft period yet); off →
 * null, i.e. not a portal concern, so no indicator.
 */
export function resolveMusicFormVisibility(hasConfig: boolean): PortalVisibilityVerdict | null {
  return hasConfig ? { visible: true } : null;
}
