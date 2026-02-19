import { runMigrations } from "@/db/migrate";
import { env } from "@/env";
import { startServer } from "@/server/server";

async function main() {
  if (env.RUN_MIGRATE) {
    await runMigrations();
  }
  await startServer();
}

void main();
