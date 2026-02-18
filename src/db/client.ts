import { env } from "@/env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const sql = postgres(env.DATABASE_URL, {
  max: env.DB_MAX_CONNECTIONS,
  idle_timeout: env.DB_IDLE_TIMEOUT,
});

export const db = drizzle(sql);
export { sql }; // Export raw connection for graceful shutdown