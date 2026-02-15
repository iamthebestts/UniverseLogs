import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { rateLimitHandler } from "../handlers";
import type { RouteApp } from "../server";

const SERVICE_VERSION = process.env.npm_package_version ?? "dev";

async function checkDatabase(): Promise<{ ok: boolean; latencyMs?: number }> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return { ok: true, latencyMs: Date.now() - start };
  } catch {
    return { ok: false };
  }
}

export default function registerHealthRoutes(app: RouteApp) {
  const healthRateLimit = rateLimitHandler({ maxRequests: 60, windowMs: 60_000 });

  app
    .get(
      "/health",
      async (ctx) => {
        const timestamp = new Date().toISOString();
        const dbCheck = await checkDatabase();

        if (!dbCheck.ok) {
          ctx.set.status = 503;
          return {
            status: "unavailable",
            timestamp,
            version: SERVICE_VERSION,
            checks: { database: "disconnected" },
          };
        }

        return {
          status: "ok",
          timestamp,
          version: SERVICE_VERSION,
          checks: {
            database: "connected",
            ...(dbCheck.latencyMs !== undefined && { databaseLatencyMs: dbCheck.latencyMs }),
          },
        };
      },
      {
        beforeHandle: healthRateLimit,
        authRequired: false,
      }
    )
    .get(
      "/ping",
      () => ({ pong: true, timestamp: new Date().toISOString() }),
      {
        beforeHandle: healthRateLimit,
        authRequired: false,
      }
    );

  return "api";
}
