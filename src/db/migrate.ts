import { resolve } from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "@/db/client";

/**
 * Aplica as migrações Drizzle (arquivos em ./drizzle) no banco configurado em DATABASE_URL.
 * Chamado na subida da aplicação quando RUN_MIGRATE=true (padrão).
 * Ver docs/deploy.md para quem roda migrações no deploy.
 */
export async function runMigrations(): Promise<void> {
  const migrationsFolder = resolve(process.cwd(), "drizzle");
  await migrate(db, { migrationsFolder });
}
