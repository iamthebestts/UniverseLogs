# Completion Guide for Logs API

Before finalizing any task, follow these steps to ensure quality and compatibility.

## 1. Run All Tests
Ensure that your changes don't break existing functionality.
- `bun test`: Run unit and integration tests.
- `bun run test:e2e`: Run E2E tests (requires `logs_test` DB).

## 2. Check Coverage
Confirm that new features or bug fixes have adequate test coverage.
- `bun run test:coverage`: Generate a coverage report.

## 3. Database Schema and Migrations
If you've modified `src/db/schema.ts`:
- `bunx drizzle-kit generate`: Generate new migration files.
- `bun run migrate`: Apply migrations locally (ensure your DB is set up).
- Verify that your changes are reflected in the database correctly.

## 4. Environment Variables
If you've introduced new environment variables:
- Update `src/env.ts` with the new schema.
- Update `.env.example` to guide other developers.

## 5. Build and Performance
- `bun run dev`: Start the server and manually verify key endpoints.
- Check for any performance regressions, especially in the log ingestion path.

## 6. Code Quality
- Ensure consistent use of TypeScript and following the functional approach.
- Follow the structured logging conventions.
- Use TypeBox for Elysia schemas where performance is critical.
