import { PrismaClient } from '@prisma/client';

// The e2e suite seeds via direct Prisma writes (ADR-0048 §5) against the same
// generated client the API uses (hoisted @prisma/client). `DATABASE_URL` points
// at the ephemeral Neon branch in CI, or the configured e2e branch locally.
export const prisma = new PrismaClient();

// The dedicated Clerk test user's stable `sub`. All seeded rows are scoped to
// this `userId`; after sign-in the real AuthGuard scopes queries to the same id,
// so the seeded data is what the signed-in user sees.
export const E2E_TEST_USER_ID = process.env.E2E_TEST_USER_ID ?? '';

if (!E2E_TEST_USER_ID) {
  throw new Error(
    'E2E_TEST_USER_ID is not set — it must equal the dedicated Clerk test user id whose data the suite seeds.',
  );
}
