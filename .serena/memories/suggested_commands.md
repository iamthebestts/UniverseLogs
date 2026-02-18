# Suggested Commands for Logs API

## Development and Runtime
- `bun run dev`: Start the development server with live reload and colorized logs.
- `bun run start`: Start the production server.
- `bun run migrate`: Run database migrations using Drizzle Kit.

## Testing and Quality
- `bun test`: Execute all unit and integration tests using Vitest.
- `bun run test:e2e`: Execute end-to-end tests (requires a `logs_test` database).
- `bun run test:coverage`: Generate a test coverage report.
- `bun test:ui`: Open the Vitest UI for a more interactive testing experience.
- `bun test:watch`: Run tests in watch mode.

## Environment and Setup
- `cp .env.example .env`: Copy the example environment file for local configuration.
- `DATABASE_URL` and `MASTER_KEY` are mandatory environment variables.
- `RUN_MIGRATE=true` can be set to automatically run migrations on server start.
- `NODE_ENV=test` must be used when running E2E tests.

## Other
- `bunx drizzle-kit generate`: Generate new migrations based on schema changes.
- `bunx drizzle-kit push`: Directly push schema changes to the database (use with caution).
