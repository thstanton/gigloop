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
// UPLOAD rule landed in #579; the per-document verdict (`resolveDocumentVisibility`) in #580.

export type PortalVisibilityReason =
  | 'until_sent'
  | 'until_published'
  | 'voided'
  | 'not_shared'
  | 'cancelled';

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

export interface PortalDocumentInput {
  type: string;
  // The signed-contract PDF references the contract it was signed from; null on the (unsigned)
  // contract PDF. Compared against the booking's active contract to detect superseded copies.
  contractId?: string | null;
  invoice?: { status: string } | null;
}

// A stored invoice PDF is only client-facing once the invoice has been delivered (SENT) or settled
// (PAID) — never an ISSUED-but-unsent copy the client was never shown, nor a VOID one superseded.
const PORTAL_VISIBLE_INVOICE_STATUSES = new Set(['SENT', 'PAID']);

function resolveInvoiceDocumentVisibility(status: string | null | undefined): PortalVisibilityVerdict {
  if (status && PORTAL_VISIBLE_INVOICE_STATUSES.has(status)) return { visible: true };
  if (status === 'VOID') return { visible: false, reason: 'voided' };
  // ISSUED (stored at issue time but not yet emailed) — and, defensively, DRAFT / missing.
  return { visible: false, reason: 'until_sent' };
}

/**
 * Per-document portal visibility (#580) — the single authority for whether a stored Document is
 * client-visible and, if not, why. Each row in the admin documents list carries its own verdict,
 * and the portal renderer reads `.visible` from the same function (via `isPortalVisibleDocument`),
 * so the two cannot disagree (ADR-0054).
 *
 * - UPLOAD → never shared (`not_shared`): private musician paperwork.
 * - CONTRACT → the signed PDF of the active contract is visible; a superseded copy reuses `voided`
 *   (its contract is VOID). A cancelled booking hides the contract concern entirely (`cancelled`,
 *   outermost — #579).
 * - INVOICE → gated on the backing invoice's delivery status (SENT/PAID visible; ISSUED unsent →
 *   `until_sent`; VOID → `voided`).
 * - everything else (SONG_LIST) → visible.
 */
export function resolveDocumentVisibility(
  doc: PortalDocumentInput,
  activeContractId: string | null,
  bookingCancelled = false,
): PortalVisibilityVerdict {
  switch (doc.type) {
    case 'UPLOAD':
      return { visible: false, reason: 'not_shared' };
    case 'CONTRACT':
      if (bookingCancelled) return { visible: false, reason: 'cancelled' };
      return doc.contractId === activeContractId
        ? { visible: true }
        : { visible: false, reason: 'voided' };
    case 'INVOICE':
      return resolveInvoiceDocumentVisibility(doc.invoice?.status);
    default:
      return { visible: true };
  }
}

/**
 * Music-form-concern visibility (#533 draft → published). Presence of the config is the on/off
 * truth (ADR-0046); publication is a second, reversible gate that mirrors invoices/contracts:
 * off (no config) → null, not a portal concern, no indicator; on-but-draft → hidden with
 * `until_published`; published → visible. Turning the form on creates a draft; the client sees it
 * only once the musician publishes.
 */
export function resolveMusicFormVisibility(
  hasConfig: boolean,
  isPublished = false,
): PortalVisibilityVerdict | null {
  if (!hasConfig) return null;
  return isPublished ? { visible: true } : { visible: false, reason: 'until_published' };
}
