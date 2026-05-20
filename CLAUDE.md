# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

GigMan — a CRM for musicians. Greenfield monorepo; SPEC.md is the source of truth for architecture and requirements.

## Stack

- **Frontend:** React + Vite + React Router v7 (`apps/web`)
- **Backend:** NestJS (TypeScript) + Prisma + Neon (serverless Postgres) (`apps/api`)
- **Auth:** Clerk (never implement custom auth)
- **File storage:** Cloudflare R2 (never write uploads to local filesystem)
- **Email:** Resend
- **PDF:** @react-pdf/renderer (executed in the API, streamed to client)
- **Monorepo:** npm workspaces

## Commands

Once set up, expected commands from repo root:

```bash
npm run dev          # start both apps in dev mode
npm run build        # build all workspaces
npm run lint         # lint all workspaces
npm run test         # run all tests
npm -w apps/api run test -- --testPathPattern=<file>  # run single test file
```

## Hard Rules (from SPEC.md — never violate)

- **Auth:** Use Clerk exclusively. Never implement custom auth.
- **Prisma models:** Every model must include `id` (UUID), `userId` (String), `createdAt`, `updatedAt`.
- **Multi-tenancy:** Every API endpoint extracts `userId` from the Clerk JWT via a global `AuthGuard`. All DB queries are scoped to that `userId`. No endpoint may return cross-tenant data.
- **Primary keys:** UUIDs everywhere. Never auto-increment integers.
- File uploads go to Cloudflare R2 — never write to the local filesystem
- **Portal routes:** `/booking/:token` validates the booking's `portalToken` — these routes bypass Clerk auth entirely.
- **Communication templates:** Stored as Tiptap JSON; rendered to HTML with variable substitution at send time.
- **Contact deletion:** Blocked at API level if the contact has associated Bookings; return a clear error (409 response).

## Architecture Notes

The NestJS API uses a global `AuthGuard` applied to all routes except portal routes (`/booking/:token`) and health checks. The guard injects `userId` from the Clerk JWT into the request context, which all service-layer methods must use to scope their Prisma queries.

PDF generation runs in the API process using `@react-pdf/renderer` and the result is streamed directly to the client — do not generate PDFs in the frontend.

## Before Every Session
- Read SPEC.md before writing any code
- Confirm you understand the hard rules below before proceeding
- If anything in the task contradicts SPEC.md, flag it rather 
  than resolving it yourself

## Code Conventions
- TypeScript strict mode in both apps
- NestJS: one module per feature (contacts, bookings, songs, etc.)
- All API responses use a consistent shape — ask before deviating
- No any types without a comment explaining why
- Errors are handled at the controller level using NestJS 
  built-in HttpException classes
- Domain types and DTOs are kept separate

## Repository Pattern
Every feature module uses three layers:
- **Controller** (`*.controller.ts`) — request/response handling only; no business logic, no Prisma calls
- **Service** (`*.service.ts`) — business logic, orchestration, validation
- **Repository** (`*.repository.ts`) — all direct Prisma calls; no business logic

The service depends on the repository; the controller depends on the service.
All three are declared as providers in the feature module.

## Package Discipline
- Do not install new npm packages without asking first
- Do not add packages to solve problems that can be solved with 
  what's already installed

## Session Behaviour
- Build only what the current session specifies
- Do not begin the next feature unprompted
- When the session task is complete, stop and summarise:
  - What was built
  - Any decisions made that weren't in the spec
  - Anything that should be reviewed before the next session
- Do not run database migrations without confirming first
- Commit all changes at the end of each session with a descriptive message
