# Logs API - Project Overview

## Purpose
A high-performance structured log ingestion and query service with native multi-tenant isolation by `UniverseId`. It's designed for distributed games (Roblox, Unity) and microservices that need real-time log centralization for debugging and telemetry.

## Tech Stack
- **Runtime:** [Bun](https://bun.sh/)
- **Web Framework:** [Elysia](https://elysiajs.com/)
- **Database:** [PostgreSQL](https://www.postgresql.org/)
- **ORM:** [Drizzle ORM](https://orm.drizzle.team/)
- **Validation:** [Zod](https://zod.dev/) & [TypeBox](https://github.com/sinclairzx81/typebox)
- **Testing:** [Vitest](https://vitest.dev/)

## Key Architectural Features
- **In-Memory Log Buffer:** Batches log insertions every 5 seconds to optimize PostgreSQL performance.
- **Multi-Tenant Isolation:** Data is strictly isolated by `UniverseId`.
- **Authentication:**
    - **API Key:** Standard access for clients (games/apps).
    - **Master Key:** Internal administrative operations.
- **Real-time WebSockets:** Streaming logs for live dashboards.
- **Graceful Shutdown:** Ensures buffered logs are flushed and DB connections are closed properly.
