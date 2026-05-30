# UI component library lives in apps/web, not a shared package

The frontend needed a structured component library beyond the shadcn/ui primitives already in `components/ui/`. We chose to expand `apps/web/src/components/` with two new tiers (`common/` for generic components, `domain/` for domain-aware wrappers) rather than extracting to a `packages/ui` workspace package.

A shared package was rejected because there is currently one consumer (the web app), and a separate package would require TypeScript project references, a separate build pipeline, and import path complexity with no current benefit. The right time to extract is when a second app needs the same components — until then, the indirection is pure overhead.

Storybook runs inside `apps/web` with stories co-located alongside their components (`Card.tsx` + `Card.stories.tsx`). Visual regression testing (Chromatic) is deferred until the component library has stabilised.
