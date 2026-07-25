import type { Prisma } from '@prisma/client';
import { tokenize } from '../bookings/booking-search';

function tokenWhere(token: string): Prisma.ContactWhereInput {
  const ci = { contains: token, mode: 'insensitive' as const };
  return {
    OR: [
      { name: ci },
      { email: ci },
      { phone: ci },
      { addressLine1: ci },
      { city: ci },
      { county: ci },
      { postcode: ci },
    ],
  };
}

/**
 * Builds the Prisma `where` clause for contact search (ADR-0067 §4).
 *
 * Matches name/email/phone/addressLine1/city/county/postcode — `notes` is deliberately
 * excluded (freeform text is more noise than signal for contacts). Uses the same tokenizer
 * as `buildBookingSearchWhere` (ADR-0041): whitespace-split, 2-char minimum, AND-of-tokens,
 * case-insensitive `contains`.
 *
 * Security invariant: `userId` is always a top-level property — it is never a sibling
 * inside an OR branch where a cross-tenant match could satisfy it.
 */
export function buildContactSearchWhere(
  userId: string,
  q: string | undefined,
): Prisma.ContactWhereInput {
  const tokens = q ? tokenize(q) : [];

  return {
    userId,
    ...(tokens.length > 0 ? { AND: tokens.map(tokenWhere) } : {}),
  };
}
