import type { BookingStatus, Prisma } from '@prisma/client';

const MIN_TOKEN_LENGTH = 2;

function tokenize(q: string): string[] {
  return q.split(/\s+/).filter((t) => t.length >= MIN_TOKEN_LENGTH);
}

function tokenWhere(token: string): Prisma.BookingWhereInput {
  const ci = { contains: token, mode: 'insensitive' as const };
  return {
    OR: [
      { title: ci },
      { customer: { name: ci } },
      { customer: { email: ci } },
      { venue: { name: ci } },
      { bookingAgent: { name: ci } },
      { series: { label: ci } },
      { eventType: ci },
      { notes: ci },
    ],
  };
}

/**
 * Builds the Prisma `where` clause for the booking list query.
 *
 * Security invariant: `userId` is always a top-level property — it is never
 * a sibling inside an OR branch where a cross-tenant match could satisfy it.
 */
export function buildBookingSearchWhere(
  userId: string,
  q: string | undefined,
  statuses: BookingStatus[],
  eventType?: string,
  from?: string,
  to?: string,
): Prisma.BookingWhereInput {
  const tokens = q ? tokenize(q) : [];
  const dateFilter =
    from || to
      ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
      : {};

  return {
    userId,
    ...(statuses.length > 0 ? { status: { in: statuses } } : {}),
    ...(eventType ? { eventType } : {}),
    ...dateFilter,
    ...(tokens.length > 0 ? { AND: tokens.map(tokenWhere) } : {}),
  };
}
