import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { api_keys as apiKeys, games, logs } from "@/db/schema";
import { env } from "@/env";

export type UniverseMetadata = {
  name: string;
  description?: string;
  extra?: Record<string, unknown>;
};

export type UniverseRecord = {
  universe_id: bigint;
  name: string;
  description?: string | null;
  metadata?: unknown;
  is_active: boolean;
  created_at: Date | null;
  updated_at?: Date | null;
};

const ROBLOX_FETCH_TIMEOUT_MS = 10_000;

async function fetchRobloxUniverse(universeId: bigint): Promise<UniverseMetadata | null> {
  if (!env.FETCH_ROBLOX_API) return null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ROBLOX_FETCH_TIMEOUT_MS);
  try {
    const idStr = universeId.toString();
    const url = `https://games.roblox.com/v1/games?universeIds=${idStr}`;
    const res = await fetch(url, { method: "GET", signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    const item = Array.isArray(data?.data) ? data.data[0] : undefined;
    if (!item) return null;
    return {
      name: item.name ?? `Universe ${idStr}`,
      description: item.description ?? undefined,
      extra: { raw: item },
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") return null;
    return null;
  }
}

export async function createUniverse(
  universeId: bigint,
  manual?: UniverseMetadata,
): Promise<UniverseRecord> {
  const fetched = await fetchRobloxUniverse(universeId);
  const meta: UniverseMetadata = manual ??
    fetched ?? {
      name: `Universe ${universeId}`,
      description: "Criado automaticamente",
      extra: { source: "auto_fallback" },
    };

  const [record] = await db
    .insert(games)
    .values({
      universe_id: universeId,
      name: meta.name,
      description: meta.description,
      metadata: meta.extra ?? {},
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .onConflictDoNothing()
    .returning();

  // If already exists, update metadata/name if provided
  let universe = record;
  let action: "create" | "update" = "create";
  if (!record) {
    const [existing] = await db
      .select()
      .from(games)
      .where(eq(games.universe_id, universeId))
      .limit(1);

    if (!existing) {
      throw new Error(`Falha ao recuperar ou criar o universo ${universeId}`);
    }

    action = "update";
    await db
      .update(games)
      .set({
        name: meta.name,
        description: meta.description,
        metadata: meta.extra ?? {},
        is_active: true,
        updated_at: new Date(),
      })
      .where(eq(games.universe_id, universeId));

    universe = {
      ...existing,
      name: meta.name,
      description: meta.description,
      metadata: meta.extra ?? {},
      is_active: true,
      updated_at: new Date(),
    } as any;
  }

  const message = action === "create" ? "Universe created" : "Universe updated";
  await db.insert(logs).values({
    universe_id: universeId,
    level: "info",
    message,
    topic: "universe",
    metadata: { action },
  });

  return universe as UniverseRecord;
}

export async function revokeUniverse(universeId: bigint): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(games)
      .set({ is_active: false, updated_at: new Date() })
      .where(eq(games.universe_id, universeId));

    await tx
      .update(apiKeys)
      .set({ is_active: false, revoked_at: new Date() })
      .where(eq(apiKeys.universe_id, universeId));

    await tx.insert(logs).values({
      universe_id: universeId,
      level: "warn",
      message: "Universe revoked",
      topic: "universe",
      metadata: { action: "revoke" },
    });
  });
}

export async function getUniverse(universeId: bigint): Promise<UniverseRecord | null> {
  const [record] = await db.select().from(games).where(eq(games.universe_id, universeId)).limit(1);
  return record ?? null;
}

export async function ensureUniverseExists(universeId: bigint): Promise<void> {
  const [record] = await db.select().from(games).where(eq(games.universe_id, universeId)).limit(1);

  if (record) return;

  if (env.AUTO_CREATE_UNIVERSE) {
    // Try to create with Roblox data if possible
    await createUniverse(universeId);
    return;
  }

  throw new Error("Universe não existe. Use a rota interna de criação.");
}

export async function listUniverseLogs(universeId: bigint, limit = 10) {
  const records = await db
    .select()
    .from(logs)
    .where(eq(logs.universe_id, universeId))
    .orderBy(desc(logs.timestamp))
    .limit(limit);
  return records;
}
