import path from 'node:path';
import { defineConfig } from 'prisma/config';
import { config } from 'dotenv';

config({ path: path.join(__dirname, '.env') });

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  engine: 'classic',
  datasource: {
    url: process.env.DATABASE_URL!,
  },
  migrations: {
    // Declared here rather than in `package.json#prisma`, which this file
    // overrides — with the hook only in package.json, `prisma migrate reset`
    // silently skipped the seed. This is what makes `bun run db:reset` a real
    // one-liner: drop, re-apply every migration, reseed (#906).
    seed: 'ts-node -r tsconfig-paths/register prisma/seed.ts',
  },
});
