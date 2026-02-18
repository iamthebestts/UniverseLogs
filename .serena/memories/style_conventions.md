# Style and Conventions for Logs API

## General Principles
- **TypeScript:** Use strict types across the entire project.
- **Functional Approach:** Prioritize functional patterns, especially for route handling and service orchestration.
- **Structured Logging:** Use the custom `logger` for consistent, machine-readable log outputs (JSON in production, colorized in development).
- **Zod/TypeBox:** Use Zod for environment validation and general logic, and TypeBox for API schema validation within Elysia for optimal performance.

## Routing Pattern
- **Route Files:** Defined as `*.route.ts` or `*.route.js` in `src/server/routes`.
- **Route Prefixing:**
    - Routes under `/api`: Standard client-facing routes, typically requires `x-api-key`.
    - Routes under `/internal`: Administrative or internal-only routes, requires `x-master-key`.
- **Custom Route Proxy:** Routes are registered via a proxy (not the raw Elysia app) that adds support for `authRequired` and `universeId` in the context.

## Multi-Tenant Isolation
- Always ensure `universeId` is used to filter queries and scoped insertions.
- `UniverseId` is derived from the API Key validation and passed through the context.

## Service Layer
- Business logic is encapsulated in `src/services/`.
- Services should be stateless and take required dependencies as parameters or use the standard project structure.

## Performance and Reliability
- **Log Buffer:** Avoid writing every single log to the database. Use `logBuffer.add()` for batching.
- **Error Handling:** Centralized error handling via `src/server/handlers/error-handler.ts`.
- **Graceful Shutdown:** Implement necessary cleanup logic in the `shutdown` function within `src/server/server.ts`.
