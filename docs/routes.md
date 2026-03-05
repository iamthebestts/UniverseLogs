# API Routes

Reference for routes defined in `src/server/routes/`. The prefix is applied by type: **api** → `/api`, **internal** → `/internal`.

## Authentication

| Type     | Header         | Use                        |
|----------|----------------|----------------------------|
| API      | `X-API-Key`    | Routes `/api/*` (per tenant) |
| Internal | `X-Master-Key` | Routes `/internal/*` (admin) |

Routes with `authRequired: false` do not require a header.

---

## health.route.ts (API)

Base: `/api`

| Method | Path      | Auth | Description |
|--------|-----------|------|-------------|
| GET    | `/health` | No   | Health check with database verification |
| GET    | `/ping`   | No   | Simple liveness |

### GET /api/health

- **200:** `{ status, timestamp, version, checks: { database, databaseLatencyMs? } }`
- **503:** Database unavailable — `{ status: "unavailable", timestamp, version, checks: { database: "disconnected" } }`

### GET /api/ping

- **200:** `{ pong: true, timestamp }`

---

## logs.route.ts (API)

Base: `/api`. All require `X-API-Key`; `universe_id` is resolved from the key.

| Method | Path         | Auth | Description |
|--------|--------------|------|-------------|
| GET    | `/logs/count`| Yes  | Total and per-level count (optional date filter) |
| GET    | `/logs`      | Yes  | List logs (filters, cursor-based pagination) |
| GET    | `/logs/:id`  | Yes  | Get log by ID (for tenant) |
| POST   | `/logs/bulk` | Yes  | Create logs in bulk (up to 100 items) |
| POST   | `/logs`      | Yes  | Create log |
| DELETE | `/logs`      | Yes  | Remove logs (by olderThan, optional level/topic) |

### GET /api/logs/count

**Query (optional):**

| Parameter | Type   | Required | Description   |
|-----------|--------|----------|---------------|
| from      | string | No       | Start ISO date |
| to        | string | No       | End ISO date   |

**200:** `{ total: number, byLevel: { info, warn, error } }`.

### GET /api/logs

**Query:**

| Parameter  | Type   | Required | Description                    |
|------------|--------|----------|--------------------------------|
| level      | string | No       | `info` \| `warn` \| `error`   |
| topic      | string | No       | Filter by topic                |
| from       | string | No       | Start ISO date                 |
| to         | string | No       | End ISO date                   |
| cursor_ts  | string | No       | Cursor: last item timestamp    |
| cursor_id  | string | No       | Cursor: last item id           |
| limit      | string | No       | 1–100 (default 20)             |

**200:** `{ logs: LogResponse[], nextCursor?: { timestamp, id } }`. Order: `timestamp DESC`, `id DESC`.

### POST /api/logs/bulk

**Body (JSON):** `{ logs: [{ level, message, metadata?, topic? }, ...] }` — same shape as single POST. Max 100 items.

**200:** `{ logs: LogResponse[] }` (inserted records, same order).

### DELETE /api/logs

**Query:**

| Parameter | Type   | Required | Description                         |
|-----------|--------|----------|-------------------------------------|
| olderThan | string | Yes      | ISO date; older logs are removed    |
| level     | string | No       | `info` \| `warn` \| `error`         |
| topic     | string | No       | Filter by topic                     |

**200:** `{ deleted: number }`.

### POST /api/logs

**Body (JSON):**

| Field    | Type   | Required | Description |
|----------|--------|----------|-------------|
| level    | string | Yes       | `info` \| `warn` \| `error` |
| message  | string | Yes       | Up to 2048 characters |
| metadata | any    | No        | Free object (JSONB) |
| topic    | string | No        | Up to 100 characters |

**201:** Serialized log object (id, universe_id, level, message, metadata, topic, timestamp).

### GET /api/logs/:id

- **200:** Log object.
- **404:** Log not found or belongs to another tenant.

---

## universes.route.ts (API)

Base: `/api`. All require `X-API-Key`.

| Method | Path                    | Auth | Description |
|--------|-------------------------|------|-------------|
| POST   | `/universes`            | Yes  | Create universe and optionally API key |
| GET    | `/universes/:id`        | Yes  | Universe data and latest logs |
| POST   | `/universes/:id/revoke` | Yes  | Revoke universe |

### POST /api/universes

**Body (JSON):**

| Field       | Type             | Required | Description |
|-------------|------------------|----------|-------------|
| universeId  | number \| string | Yes      | Universe ID (Roblox or numeric) |
| name        | string           | No       | Universe name |
| description | string           | No       | Description |
| createKey   | boolean          | No       | If `false`, no API key is created (default: true) |

**200:** `{ universe, key? }` (serialized).

### GET /api/universes/:id

- **200:** `{ universe, logs }` (up to 10 latest logs). `null` if universe does not exist.

### POST /api/universes/:id/revoke

- **200:** `{ success: true }`.

---

## api-keys.route.ts (Internal)

Base: `/internal`. All require `X-Master-Key`.

| Method | Path                | Description |
|--------|---------------------|-------------|
| POST   | `/keys/register`    | Register new API key for a universe |
| POST   | `/keys/revoke`      | Revoke API key |
| GET    | `/keys/validate`    | Validate API key (query) |
| GET    | `/keys/list`        | List keys (optional by universeId) |
| GET    | `/keys/count`       | Count active keys |

### POST /internal/keys/register

**Body (JSON):** `{ universeId: number | string }`

**200:** `{ key }` (new API key).

### POST /internal/keys/revoke

**Body (JSON):** `{ key: string }`

**200:** `{ success: true }`.  
**Error:** invalid key.

### GET /internal/keys/validate

**Query:** `key` (string)

**200:** `{ valid: true, universeId }`.

### GET /internal/keys/list

**Query:** `universeId` (optional, number or string)

**200:** List of keys (serialized).

### GET /internal/keys/count

**200:** `{ count: number }`.

---

## universes.internal.route.ts (Internal)

Base: `/internal`. Requires `X-Master-Key`.

| Method | Path                   | Description |
|--------|------------------------|-------------|
| POST   | `/universes/create`    | Create universe (no key) |

### POST /internal/universes/create

**Body (JSON):** `{ universeId: number | string }`

**200:** Created universe object.
