# Deploy and Migrations

## Who Runs Migrations on Deploy

**By default, the application runs migrations when the process starts.**

- **When:** Before opening the HTTP port: load env → (if `RUN_MIGRATE=true`) run Drizzle migrations → start server.
- **Where:** Any environment where you start the API with `bun run start` (Docker, Discloud, PM2, etc.), as long as `RUN_MIGRATE` is not disabled.
- **How to disable:** Set `RUN_MIGRATE=false`. Then migrations are **not** run on startup; an external step (person or CI/CD pipeline) must run `bun run migrate` with the production `DATABASE_URL` before (or after) deploy.

Summary:

| Who runs migrations | When to use |
|---------------------|-------------|
| **App on startup** (`RUN_MIGRATE=true`, default) | Simple deploy (Docker, Discloud, single instance). One instance applies migrations; others that start later see the updated schema. |
| **CI / person** (`RUN_MIGRATE=false` and `bun run migrate` in pipeline or manually) | When deploy requires a separate migration step (e.g. release job that runs before switching API version). |

Environment variable in `.env`:

```bash
# true = app runs migrations on start (default)
# false = you or CI runs "bun run migrate" before deploy
RUN_MIGRATE=true
```

### Multiple Instances

If several replicas start at once, they all try to run migrations; Drizzle applies pending ones and the rest are idempotent. To avoid any race, use a single migration step before deploy (release job or `RUN_MIGRATE=false` and run `bun run migrate` once).

---

## Deploy with Docker

1. Build and run (the app runs migrations on start because `RUN_MIGRATE` is not set and defaults to `true`):

   ```bash
   docker build -t universe-logs .
   docker run -p 8080:8080 --env-file .env universe-logs
   ```

2. If you want **only the pipeline/operator** to run migrations, set in the container env:

   ```bash
   docker run -p 8080:8080 -e RUN_MIGRATE=false --env-file .env universe-logs
   ```

   and run `bun run migrate` (or a job using the same image and `DATABASE_URL`) before starting the API containers.

---

## Deploy on Discloud

1. Set env in the dashboard: `PORT=8080`, `HOST=0.0.0.0`, `DATABASE_URL`, `MASTER_KEY`, etc. (see `.env.example`).
2. With default `RUN_MIGRATE=true`, Discloud runs migrations when the app starts, before serving traffic.
3. For migrations only via CI/person: in the dashboard add `RUN_MIGRATE=false` and run `bun run migrate` (with production `DATABASE_URL`) in your pipeline or manually before the next deploy.

---

## CI/CD (GitHub Actions)

The automated pipeline (`.github/workflows/pipeline.yml`) handles the lifecycle:

- **CI (push to main/develop and PRs):**
  - Lint and format (**Biome**)
  - Type check (**TSC**)
  - Unit tests and coverage (**Vitest**)
  - **Docker** build check
- **CD (push to main only):**
  - Auto deploy to **Discloud** via `discloud/deploy-action`.
  - **Requirement:** Configure the `DISCLOUD_TOKEN` secret in GitHub settings.

---

## Running Migrations Manually (CLI)

Whenever you need to apply migrations outside of API startup (e.g. with `RUN_MIGRATE=false`):

```bash
# With .env loaded (production)
bun run migrate

# Or with explicit env
DATABASE_URL="postgresql://..." bun run migrate
```

The script uses `drizzle-kit migrate` and `drizzle.config.ts` (which reads `DATABASE_URL` from the environment).
