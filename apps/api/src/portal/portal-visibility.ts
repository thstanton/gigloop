// The single portal-visibility authority (ADR-0054). A deterministic, I/O-free module that
// answers "is concern X visible on the portal right now, and if not, why?". Every consumer reads
// its verdict from here, so they cannot disagree — the client portal renderer and the admin
// indicator (both audiences of `resolveContractVisibility` etc.), and, from #890, the band
// portal.
//
// This module is intentionally dependency-free (no NestJS, no Prisma, no repos): it is a pure
// function file imported across the portal, bookings, documents and communications modules,
// which avoids any DI/import cycle between them.
//
// Slice 1 (#578) seeds the contract and music-form concerns. The booking-CANCELLED gate and the
// UPLOAD rule landed in #579; the per-document verdict (`resolveDocumentVisibility`) in #580.
// #890 (ADR-0073) widens every verdict function with an `audience` parameter ahead of the band
// portal — a prefactor with no behaviour change for the existing `CLIENT` audience.

/**
 * Who is asking (ADR-0073) — the client portal (`/booking/:token`) or a dep's band portal
 * (`/band/:token`, #880). Orthogonal to the *other* sense of "audience" ADR-0054's 2026-08-18
 * amendment already used, for a document's *ownership*: whether a booking owns the document
 * being asked about (the `ownedByBooking` parameter below, unchanged). Do not confuse the two —
 * this one is about who is looking, not what is being looked at.
 *
 * Declared once as this array, the type derived from it — same idiom as `ContractStatus` below —
 * so the type is never a hand-written union a table has to be checked against.
 */
export const PORTAL_AUDIENCES = ['CLIENT', 'BAND'] as const;

export type PortalAudience = (typeof PORTAL_AUDIENCES)[number];

/**
 * The one place every verdict function's audience branch is decided (below). A `switch` with a
 * `never`-typed default, not three independent `if (audience === 'BAND')` checks, so a third
 * audience is a compile error here instead of silently falling through to CLIENT behaviour at
 * whichever call site forgot to special-case it.
 */
function isBandAudience(audience: PortalAudience): boolean {
  switch (audience) {
    case 'BAND':
      return true;
    case 'CLIENT':
      return false;
    default: {
      const unhandled: never = audience;
      throw new Error(`Unhandled portal audience: ${String(unhandled)}`);
    }
  }
}

/**
 * The full ReasonCode vocabulary, declared exactly once as an array so both the type and any
 * Swagger `enum` can be derived from it rather than hand-restated (#786). A union type is not
 * enumerable at runtime, so a DTO documenting a verdict would otherwise have to re-list the
 * members — a second declaration, and the drift #750 was about.
 */
export const PORTAL_VISIBILITY_REASONS = [
  'until_sent',
  'until_published',
  'voided',
  'not_shared',
  'cancelled',
  'other_booking',
] as const;

export type PortalVisibilityReason = (typeof PORTAL_VISIBILITY_REASONS)[number];

export interface PortalVisibilityVerdict {
  visible: boolean;
  reason?: PortalVisibilityReason;
}

/**
 * The subset of ReasonCodes a *document* verdict can carry (#750). A document is never
 * draft-then-published — that gate belongs to the booking-level music-form concern (#533) — so
 * `until_published` is unreachable for documents under ADR-0054's per-concern mapping.
 *
 * Declared exactly once, as this array: the reason type and the DTO's Swagger `enum` are both
 * derived from it, so the wire contract and the documentation cannot drift apart. `satisfies`
 * pins it as a genuine subset of `PortalVisibilityReason`.
 */
export const DOCUMENT_PORTAL_VISIBILITY_REASONS = [
  'until_sent',
  'voided',
  'not_shared',
  'cancelled',
  'other_booking',
] as const satisfies readonly PortalVisibilityReason[];

export type DocumentPortalVisibilityReason = (typeof DOCUMENT_PORTAL_VISIBILITY_REASONS)[number];

export interface DocumentPortalVisibilityVerdict {
  visible: boolean;
  reason?: DocumentPortalVisibilityReason;
}

/**
 * The full contract lifecycle, declared once as an array for the same reason as
 * `PORTAL_VISIBILITY_REASONS` above — a response DTO documenting a contract's status derives its
 * Swagger `enum` from here (#786) instead of restating the members. Note this is the *read*
 * vocabulary: `UpdateContractDto` deliberately accepts a narrower writable subset (no SENT — that
 * transition is the `POST …/send` endpoint's, not a manual patch's).
 */
export const CONTRACT_STATUSES = ['DRAFT', 'SENT', 'SIGNED', 'VOID'] as const;

export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

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
 *
 * The contract is a CLIENT-only concern (ADR-0073): it is not part of `BAND_PORTAL_FIELDS` and
 * has no plan to become one (a band-facing agreement is parked as a distinct future concern, per
 * the ADR's Consequences). For `BAND` this returns null unconditionally — same "not a live
 * concern" shape as no contract existing yet, ahead of any contract-status check.
 */
export function resolveContractVisibility(
  contractStatus: ContractStatus | null,
  audience: PortalAudience,
  bookingCancelled = false,
): PortalVisibilityVerdict | null {
  if (isBandAudience(audience)) return null;
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

function resolveInvoiceDocumentVisibility(
  status: string | null | undefined,
): DocumentPortalVisibilityVerdict {
  if (status && PORTAL_VISIBLE_INVOICE_STATUSES.has(status)) return { visible: true };
  if (status === 'VOID') return { visible: false, reason: 'voided' };
  // ISSUED (stored at issue time but not yet emailed) — and, defensively, DRAFT / missing.
  return { visible: false, reason: 'until_sent' };
}

/**
 * A local mirror of Prisma's `DocumentType` enum members, declared as a plain string union so
 * this module can stay Prisma-free (see the module comment above) — the same boundary
 * `apps/web/src/types/api.ts`'s own `DocumentType` mirror crosses for the frontend. Keep in sync
 * with `schema.prisma`'s `DocumentType` enum by hand; `CALL_SHEET` joins this list in #892/#893
 * once ADR-0072 §8's enum→TEXT migration lands.
 */
type DocumentTypeValue = 'CONTRACT' | 'INVOICE' | 'SONG_LIST' | 'UPLOAD';

/**
 * Band document visibility (ADR-0073 §3) — a total, fail-closed mapping by type, defaulting
 * hidden. `Record<DocumentTypeValue, boolean>` is exhaustive over every currently-known type by
 * construction: a member missing from this object fails to typecheck, so a new `DocumentType`
 * cannot be half-added. Only the call sheet crosses; every type mapped here today stays hidden —
 * #892 adds `CALL_SHEET`'s row once it exists. No `ReasonCode`: ADR-0073 §7 rejected widening the
 * vocabulary for this, so a hidden BAND document verdict carries no reason.
 */
const BAND_DOCUMENT_VISIBILITY: Record<DocumentTypeValue, boolean> = {
  CONTRACT: false,
  INVOICE: false,
  SONG_LIST: false,
  UPLOAD: false,
};

/**
 * Per-document portal visibility (#580) — the single authority for whether a stored Document is
 * client-visible and, if not, why. Each row in the admin documents list carries its own verdict,
 * and the portal renderer reads `.visible` from the same function (via `isPortalVisibleDocument`),
 * so the two cannot disagree (ADR-0054).
 *
 * For `BAND` (#890/ADR-0073 §3), the CLIENT-only context below (active contract, cancellation,
 * ownership) is irrelevant — a fail-closed lookup by type alone decides it, and a type this
 * module doesn't yet know about (a future enum member not yet mirrored into
 * `DocumentTypeValue`) falls through to hidden rather than erroring, so **forgetting is safe**.
 *
 * - **Ownership** (`other_booking`, outermost — ADR-0054 amendment 2026-08-18) — a document is
 *   portal-visible through a booking's portal only if that booking owns it. A [[BookingSeries]]
 *   invoice's document belongs to no single booking (`bookingId: null`) yet is discoverable from
 *   every member booking's Documents card (#848), so it must never leak onto a member booking's
 *   portal at any state — it is addressed to the series customer, who may differ from the member
 *   booking's own customer, and itemises every other member's fee. `ownedByBooking` is supplied by
 *   the caller (never inferred from doc type here) so the gate holds even if a future caller widens
 *   its query to include documents beyond the booking's own — see the amendment for why relying on
 *   today's narrow query would be "an accident of query shape".
 * - UPLOAD → never shared (`not_shared`): private musician paperwork.
 * - CONTRACT → the signed PDF of the active contract is visible; a superseded copy reuses `voided`
 *   (its contract is VOID). A cancelled booking hides the contract concern entirely (`cancelled`,
 *   outermost among the state gates — #579).
 * - INVOICE → gated on the backing invoice's delivery status (SENT/PAID visible; ISSUED unsent →
 *   `until_sent`; VOID → `voided`).
 * - everything else (SONG_LIST) → visible.
 *
 * The narrowed return type is the enforcement point for #750: it makes the reachable reasons a
 * compile-time fact, so the DTO enum derived from `DOCUMENT_PORTAL_VISIBILITY_REASONS` cannot fall
 * out of step with what this function can actually emit.
 */
export function resolveDocumentVisibility(
  doc: PortalDocumentInput,
  activeContractId: string | null,
  audience: PortalAudience,
  bookingCancelled = false,
  ownedByBooking = true,
): DocumentPortalVisibilityVerdict {
  if (isBandAudience(audience)) {
    return { visible: BAND_DOCUMENT_VISIBILITY[doc.type as DocumentTypeValue] ?? false };
  }
  if (!ownedByBooking) return { visible: false, reason: 'other_booking' };
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
 *
 * Like the contract concern, the music form is CLIENT-only (ADR-0073) — out of
 * `BAND_PORTAL_FIELDS` scope. For `BAND` this returns null unconditionally, ahead of the
 * has-config check.
 */
export function resolveMusicFormVisibility(
  hasConfig: boolean,
  audience: PortalAudience,
  isPublished = false,
): PortalVisibilityVerdict | null {
  if (isBandAudience(audience)) return null;
  if (!hasConfig) return null;
  return isPublished ? { visible: true } : { visible: false, reason: 'until_published' };
}
