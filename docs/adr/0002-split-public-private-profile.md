# Split UserProfile into PublicProfile and UserProfile at the DB level

The musician's settings contain both portal-visible data (name, bio, logo, contact details) and sensitive data (bank details, VAT number, address). Rather than relying on DTO filtering to keep sensitive fields out of portal responses, we split these into two separate Prisma models: `PublicProfile` and `UserProfile`.

`PublicProfile` holds everything safe to return to unauthenticated portal clients. `UserProfile` holds everything that must never leave the authenticated API surface. The portal fetches `PublicProfile` only; it never touches `UserProfile`. DTO filtering alone was rejected because it relies on developer discipline at every call site — a structural boundary is safer.

Both models are keyed by `userId` and created together on first access.
