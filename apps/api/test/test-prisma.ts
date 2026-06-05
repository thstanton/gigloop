import { PrismaClient } from '@prisma/client';

// Shared Prisma client for fixture setup/teardown in beforeAll/afterAll.
// Uses DATABASE_URL from environment — the integration CI job sets this to the ephemeral Neon branch.
export const prisma = new PrismaClient();
