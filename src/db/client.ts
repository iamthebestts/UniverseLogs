import { setDefaultResultOrder } from "node:dns";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env";

const parseBooleanEnv = (value: string | undefined): boolean | undefined => {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return undefined;
};

const getHostnameFromDatabaseUrl = (databaseUrl: string): string | null => {
  try {
    return new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
};

const hostname = getHostnameFromDatabaseUrl(env.DATABASE_URL);
const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
const isRemoteDatabase = hostname ? !isLocalHost : false;
const isSupabaseHost = hostname?.includes("supabase") ?? false;
const disableForceIpv4 = parseBooleanEnv(process.env.DB_DISABLE_FORCE_IPV4) ?? false;

if (!disableForceIpv4) {
  setDefaultResultOrder("ipv4first");
}

const sslEnv = process.env.DB_SSL?.trim().toLowerCase();
const ssl =
  sslEnv === "no-verify" || sslEnv === "insecure"
    ? ({ rejectUnauthorized: false } as const)
    : (parseBooleanEnv(process.env.DB_SSL) ?? isRemoteDatabase)
      ? "require"
      : false;

const prepare = parseBooleanEnv(process.env.DB_PREPARE_STATEMENTS) ?? !isSupabaseHost;

const sql = postgres(env.DATABASE_URL, {
  max: env.DB_MAX_CONNECTIONS,
  idle_timeout: env.DB_IDLE_TIMEOUT,
  ssl,
  prepare,
});

export const db = drizzle(sql);
export { sql };
