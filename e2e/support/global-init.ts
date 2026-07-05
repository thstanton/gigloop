import { clerkSetup } from '@clerk/testing/playwright';
import { prisma } from './prisma';
import { resetTestData, seedBaselineProfile } from './seed';

// globalSetup hook (ADR-0048 §3/§5). Deliberately browser-free — the actual
// sign-in that needs the web server running lives in the `setup` project
// (auth.setup.ts), which runs after webServer is up. Here we only:
//  - mint the Clerk testing token (pure Backend API call), and
//  - reset + seed the account baseline so the signed-in user lands on the
//    dashboard rather than the onboarding wizard.
export default async function globalInit(): Promise<void> {
  await clerkSetup({ publishableKey: process.env.CLERK_PUBLISHABLE_KEY });
  await resetTestData();
  await seedBaselineProfile();
  await prisma.$disconnect();
}
