# Operations Guide — Logs API

This document describes how to operate, monitor, and maintain the Logs API service in production.

## 1. Monitoring and Metrics (Observability)

The application uses [Bun](https://bun.sh) and [Elysia](https://elysiajs.com). For production monitoring, watch:

### Main Health Endpoints
- `GET /ping`: Immediate `{"pong": true}` response for load balancers.
- `GET /health`: Checks database connectivity.

### Recommended Metrics (RED Method)
The system does not yet integrate Prometheus/OpenTelemetry natively; use server logs to monitor:
- **Requests:** Volume of logs sent per second.
- **Errors:** Frequency of 5xx errors or database timeouts.
- **Duration:** Average latency of `/logs` and `/universes` routes.

### Metrics and Benchmarks

For a local load test (requires a running server and a valid API key):

```bash
bun run benchmark
```

The script sends consecutive requests to `POST /api/logs` and reports latency (average, p95) and throughput. Reference values in a typical environment (Bun, local Postgres):

| Metric | Target |
|--------|--------|
| p95 latency (POST /api/logs) | &lt; 10 ms |
| Throughput (writes/s, single client) | &gt; 500/s (buffer reduces DB round-trips) |

The WebSocket (`/realtime`) is tuned for low broadcast latency; for benchmarks with many concurrent clients, use tools like `k6` or `artillery` against the HTTP and WS endpoints.

## 2. Database Management (Postgres)

The system uses **Drizzle ORM**.

### Migrations
Migrations run automatically on container startup if `RUN_MIGRATE=true`.
- **Check status:** Inspect container logs at startup.
- **Manual rollback:** Requires direct database access or running Drizzle CLI locally.

### Connections
Set `DB_MAX_CONNECTIONS` and `DB_IDLE_TIMEOUT` according to your RDS/Postgres cluster capacity. Default is 10 connections per instance.

## 3. Scaling

### Horizontal Scaling
The application is stateless and can be scaled horizontally.
- **Note:** Current rate limiting is in-memory. Scaling to multiple instances without a shared Redis will increase the effective request limit per IP proportionally to the number of replicas.

### Container Resources
- **CPU/Memory:** Start with 512MB RAM and 0.5 vCPU. Bun is very efficient.

## 4. Runbook: Common Issues

### 1. Database Connection Timeout
- **Symptom:** `/health` returns status `unavailable`.
- **Cause:** Database down or connection pool exhausted.
- **Action:** Increase `DB_MAX_CONNECTIONS` or check Postgres load.

### 2. Growing Memory
- **Symptom:** Container restarts repeatedly.
- **Cause:** The log buffer (`LogBuffer`) may be holding too many items if the database is slow.
- **Action:** Check write performance to the `logs` table.

### 3. Migration Failure
- **Symptom:** Container hangs on boot.
- **Action:** Set `RUN_MIGRATE=false`, start the service, and inspect tables in the database manually.

## 5. Security

- **Master Key:** Rotate `MASTER_KEY` periodically and never log it.
- **API Keys:** Created via `/api-keys` for service consumers. Use the internal service to revoke suspicious keys.
