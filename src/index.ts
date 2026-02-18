import "@/env"; // Carrega variáveis de ambiente.
import { runMigrations } from "@/db/migrate";
import { env } from "@/env";
import { startServer } from "@/server/server";
import { logger } from "@/core/logger";

async function main() {
  // Runtime safety check: Never allow disabling auth in production.
  // process.env is used directly because USE_AUTH was removed from env.ts
  if (process.env.USE_AUTH === "false" && env.NODE_ENV === "production") {
    logger.error("FATAL: USE_AUTH cannot be disabled in production mode. System exit.");
    process.exit(1);
  }

  if (env.RUN_MIGRATE) {
    await runMigrations();
  }
  await startServer();
}

void main();
