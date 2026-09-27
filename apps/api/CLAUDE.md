# apps/api — CLAUDE.md

Conventions for the NestJS API. Loads when working with files under `apps/api`.
Repo-wide hard rules, branching, release and session conventions live in the root `CLAUDE.md`.

## API Documentation
- Every DTO property must have an `@ApiProperty()` (or `@ApiPropertyOptional()`) decorator so Scalar stays accurate
- Update these decorators whenever a DTO field is added, removed, renamed, or changes type
- Controller methods must use `@ApiResponse()` (or the typed variants) to document all possible response shapes

## Validation
- All input validation belongs in DTOs using `class-validator` decorators (e.g. `@IsString()`, `@IsUUID()`, `@IsOptional()`)
- All type coercion/transformation belongs in DTOs using `class-transformer` decorators (e.g. `@Type(() => Number)`)
- Services must not re-validate fields already declared in DTOs — trust the DTO
- The global `ValidationPipe` (with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`) strips undeclared properties and rejects invalid payloads before they reach the service

## Repository Pattern
Every feature module uses three layers:
- **Controller** (`*.controller.ts`) — request/response handling only; no business logic, no Prisma calls
- **Service** (`*.service.ts`) — business logic and orchestration only; no input validation (that belongs in DTOs)
- **Repository** (`*.repository.ts`) — all direct Prisma calls; no business logic

The service depends on the repository; the controller depends on the service.
All three are declared as providers in the feature module.
