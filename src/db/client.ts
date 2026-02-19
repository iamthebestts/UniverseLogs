import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env";

const sql = postgres(env.DATABASE_URL, {
  max: env.DB_MAX_CONNECTIONS,
  idle_timeout: env.DB_IDLE_TIMEOUT,
});

export const db = drizzle(sql);
export { sql };
