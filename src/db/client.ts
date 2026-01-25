import { env } from "@/env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const sql = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
});

export const db = drizzle(sql);