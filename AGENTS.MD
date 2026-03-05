# AGENTS.MD

Central document for project conventions and rules. **Read before changing code, documentation, tests, or configuration.** Cursor uses this file via `.cursorrules`.

---

## 1. Project Overview

| Field | Value |
|-------|--------|
| **Name** | UniverseLogs |
| **Description** | Multi-tenant log ingestion and query service. Focused on high performance for Roblox games (UniverseId) and distributed applications. |
| **Goal** | Centralize observability with API Key isolation and flexible schema (JSONB). |

---

## 2. Tech Stack

| Area | Technology |
|------|------------|
| Runtime | Bun |
| Language | TypeScript |
| HTTP | ElysiaJS |
| Database | PostgreSQL |
| ORM | Drizzle ORM |
| Tests | Vitest + @vitest/ui + @vitest/coverage-v8 |
| Validation | Zod / TypeBox (Elysia `t`) |

---

## 3. Code Structure

### 3.1 Directories

```
src/
├── core/           # Core logic and base types
├── db/             # Drizzle and schemas (schema.ts)
├── services/       # Business logic and DB access (HTTP-agnostic)
└── server/         # HTTP layer (Elysia)
    ├── routes/     # Endpoints (*.route.ts)
    ├── handlers/   # Rate limit, error handler, etc.
    ├── auth/       # Authentication
    └── server.ts   # Entrypoint and dynamic route loading
```

### 3.2 Routes (proxy pattern)

- File in `src/server/routes/` with suffix `.route.ts`.
- Export `default(app)` and return `"api"` (prefix `/api`) or `"internal"` (prefix `/internal`).
- The `app` is a Proxy that applies auth and prefixes; use `authRequired: true` when needed.
- **Route:** parsing, validation (`t`), response. **Service:** business logic and DB (no Elysia).

### 3.3 Database (Drizzle)

- **Tables:** `games` (tenants), `api_keys`, `logs` (with `metadata` jsonb).
- **IDs:** `universe_id` and `place_id` always `bigint` (Roblox).
- In log queries, **always** filter by `universe_id` first. Avoid dynamic SQL; use Drizzle/parameters.

---

## 4. Authentication and Security

- **API:** header `X-API-Key`; tenant inferred from key (client **never** sends `universe_id`).
- **Internal:** `X-Master-Key` for `/internal/*` routes.
- Never expose keys, `MASTER_KEY`, or secrets in code, logs, or responses.
- Isolation: all tenant queries filtered by `universe_id` (resolved via API Key).
- Production: no stack traces or internal details; global ErrorHandler with standardized responses.

---

## 5. Documentation and i18n

- **Default language (root):** en-US. Main docs in English at repo root and in `docs/`.
- **Pt-BR:** kept in dedicated folders; do not overwrite en-US at root.

| Location | Content |
|----------|---------|
| `README.md`, `SECURITY.md` | en-US (root) |
| `pt-br/` | README and SECURITY in pt-BR |
| `docs/` | routes, websocket, deploy, operations (en-US) |
| `docs/pt-br/` | Same docs in pt-BR (rotas, websocket, deploy, operations) |
| `.github/ISSUE_TEMPLATE/` | `bug_report.md`, `feature_request.md` (en-US) |
| `.github/ISSUE_TEMPLATE/pt-br/` | Templates in pt-BR |
| `sdk/roblox/docs.md` | en-US |
| `sdk/roblox/pt-br/docs.md` | pt-BR |

**Update when changing contract or routes:** `docs/routes.md`, `docs/websocket.md`, `docs/operations.md`; deploy in `docs/deploy.md`.

---

## 6. Editor and Tooling

- **.vscode/settings.json:** shared formatting and lint (e.g. markdown with markdownlint).
- Keep formatter/linter config in the repo for consistency; do not commit local paths or secrets.

---

## 7. Rules by Area (for AI and developers)

### 7.1 Code

- **Runtime/scripts:** Bun (not Node).
- **Routes:** `*.route.ts`, `default(app)`, return `"api"` or `"internal"`. Elysia validation (`t`) on body/query/params.
- **Config:** use `env` or constants; no sensitive or environment-specific values hardcoded.
- **Types:** `universe_id` and `place_id` as `bigint`.

### 7.2 Database

- Filter by `universe_id` first; use `bigint` for Roblox IDs.
- Migrations via Drizzle; document in `docs/deploy.md` who runs migrations in each environment.
- Rollback: avoid destructive migrations without a plan.

### 7.3 Tests

- Before considering done: run `bun run check` and `bun run type-check`; unit tests (and E2E if applicable).
- New endpoints or contract changes: add/update tests and, if relevant, `docs/routes.md`.
- Do not break auth, rate limit, or schema without test coverage.

### 7.4 Documentation

- New routes or contract changes → `docs/routes.md`. WebSocket → `docs/websocket.md`. Operations → `docs/operations.md`.
- Deploy and critical variables → `docs/deploy.md`.

### 7.5 Deploy and Ops

- Critical variables: `USE_AUTH`, `MASTER_KEY`, `PORT`, rate limits; centralized and documented.
- Changes that affect deploy must be reflected in documentation.

### 7.6 Commits and Conventions

- Clear, conventional messages (e.g. `feat:`, `fix:`, `docs:`); reference issues when possible.

### 7.7 AI Behavior

- Maintain compatibility with Bun, ElysiaJS, and Drizzle.
- Do not invent endpoints, tenants, or data out of scope.
- Suggest performance, security, and maintenance improvements when relevant.
- When changing project structure or conventions, update this AGENTS.MD (and `.cursorrules` if it exists).

---

## 8. Current State (reference)

- **Version:** See `package.json` (used at runtime for health/docs).
- **Tests:** Production Ready (100% pass rate); coverage on Rate Limit, Error Handler, and Services.

---

*Cursor entry point: `.cursorrules` points to this file.*
