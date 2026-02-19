import { afterAll, beforeEach } from "vitest";
import { logBuffer } from "@/core/log-buffer";
import { sql } from "@/db/client";
import { resetAllRateLimits } from "@/server/handlers/rate-limit";

/**
 * Limpa o banco de dados de teste antes de cada teste.
 * Isso garante que os testes sejam isolados e não dependam dos dados uns dos outros.
 */
beforeEach(async () => {
  // Ensure all logs are flushed before truncation
  await logBuffer.flush();

  resetAllRateLimits();
  const tables = await sql`
    SELECT tablename FROM pg_catalog.pg_tables 
    WHERE schemaname = 'public' 
    AND tablename NOT LIKE 'drizzle_%';
  `;

  for (const table of tables) {
    await sql.unsafe(`TRUNCATE TABLE "${table.tablename}" RESTART IDENTITY CASCADE;`);
  }
});
