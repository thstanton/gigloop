# Onboarding completion tracked by explicit timestamp flag

New musicians must complete a setup wizard before accessing the admin. We record completion via `UserProfile.onboardingCompletedAt` — a nullable timestamp that is null until the musician finishes or skips all onboarding steps, then stamped by `POST /me/onboarding/complete`.

The alternative was to derive "needs onboarding" from data state (e.g. no songs seeded, no `businessName` set). That approach is fragile: a musician who legitimately skips song selection looks identical to a brand-new user, causing re-entry into onboarding on every sign-in. An explicit flag is unambiguous and stable regardless of what the musician chose to skip.

The flag is set by a dedicated endpoint rather than as a side-effect of the final step's save, so that "skip all" paths have a single clear completion signal independent of which steps were completed.
