import { and, count, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { logBuffer } from "@/core/log-buffer";
import { db } from "@/db/client";
import { games, logs } from "@/db/schema";
import { wsManager } from "@/server/websocket/manager";

export interface LogData {
  level: "info" | "warn" | "error";
  message: string;
  metadata?: unknown;
  topic?: string;
}

/**
 * Garante que o universo exista no banco de dados.
 * Utiliza cache simples para evitar hits desnecessários no banco em alta volumetria.
 */
const knownUniverses = new Set<string>();

async function ensureUniverseExists(universeId: bigint) {
  const idStr = universeId.toString();
  if (knownUniverses.has(idStr)) return;

  await db
    .insert(games)
    .values({ universe_id: universeId, name: "Auto-created universe" })
    .onConflictDoNothing();

  knownUniverses.add(idStr);
}

/**
 * Cria um log para um universo específico utilizando buffer em memória para alta performance.
 * O log é enfileirado e gravado em lote assincronamente.
 *
 * @param universeId - O ID do universo.
 * @param data - Os dados do log.
 * @returns O log criado (objeto em memória, antes da persistência).
 */
export async function createLog(universeId: bigint, data: LogData) {
  // 1. Garantir existência do universo (Non-blocking para o buffer de logs, mas necessário para FK)
  await ensureUniverseExists(universeId);

  // 2. Criar objeto do log com ID gerado pela aplicação
  const logEntry = {
    id: crypto.randomUUID(),
    universe_id: universeId,
    level: data.level,
    message: data.message,
    metadata: data.metadata,
    topic: data.topic,
    timestamp: new Date(),
  };

  // 3. Adicionar ao buffer de escrita
  logBuffer.add(logEntry);

  // 4. Broadcast via WebSocket (Realtime)
  wsManager.broadcast(universeId, logEntry);

  // 5. Retornar imediatamente (Fire-and-forget)
  return logEntry;
}

/**
 * Recupera um log específico pelo seu ID e ID do universo.
 * @param id - O ID único do log a ser recuperado.
 * @param universeId - O ID do universo associado ao log.
 * @returns O objeto do log encontrado ou null se não existir.
 */
export async function getLogById(id: string, universeId: bigint) {
  const [log] = await db
    .select()
    .from(logs)
    .where(and(eq(logs.id, id), eq(logs.universe_id, universeId)))
    .limit(1);

  return log || null;
}

export const LOGS_LIST_DEFAULT_LIMIT = 20;
export const LOGS_LIST_MAX_LIMIT = 100;

export interface ListLogsFilters {
  level?: "info" | "warn" | "error";
  topic?: string;
  from?: Date;
  to?: Date;
  cursorTimestamp?: Date;
  cursorId?: string;
  limit?: number;
}

/**
 * Lista logs do universo com filtros e paginação cursor-based.
 * Ordenação: timestamp DESC, id DESC.
 */
export async function listLogs(universeId: bigint, filters: ListLogsFilters) {
  const limit = Math.min(
    Math.max(1, filters.limit ?? LOGS_LIST_DEFAULT_LIMIT),
    LOGS_LIST_MAX_LIMIT,
  );

  const conditions = [eq(logs.universe_id, universeId)];

  if (filters.level) conditions.push(eq(logs.level, filters.level));
  if (filters.topic) conditions.push(eq(logs.topic, filters.topic));
  if (filters.from) conditions.push(sql`${logs.timestamp} >= ${filters.from}`);
  if (filters.to) conditions.push(sql`${logs.timestamp} <= ${filters.to}`);

  if (filters.cursorTimestamp != null && filters.cursorId != null) {
    conditions.push(
      or(
        lt(logs.timestamp, filters.cursorTimestamp),
        and(eq(logs.timestamp, filters.cursorTimestamp), lt(logs.id, filters.cursorId)),
      )!,
    );
  }

  const rows = await db
    .select()
    .from(logs)
    .where(and(...conditions))
    .orderBy(desc(logs.timestamp), desc(logs.id))
    .limit(limit);

  return rows;
}

/**
 * Insere múltiplos logs em uma única transação (batch insert).
 * Não usa o buffer; retorna os registros inseridos normalizados.
 */
export async function createLogsBulk(
  universeId: bigint,
  items: LogData[],
): Promise<(typeof logs.$inferSelect)[]> {
  await ensureUniverseExists(universeId);

  const values = items.map((data) => ({
    id: crypto.randomUUID(),
    universe_id: universeId,
    level: data.level,
    message: data.message,
    metadata: data.metadata ?? {},
    topic: data.topic ?? null,
    timestamp: new Date(),
  }));

  const ids = values.map((v) => v.id);
  const inserted = await db.transaction(async (tx) => {
    await tx.insert(logs).values(values);
    const rows = await tx
      .select()
      .from(logs)
      .where(and(eq(logs.universe_id, universeId), inArray(logs.id, ids)));
    const orderMap = new Map<string, number>(ids.map((id, i) => [id, i]));
    return rows.sort(
      (a, b) => (orderMap.get(String(a.id)) ?? 0) - (orderMap.get(String(b.id)) ?? 0),
    );
  });

  for (const logEntry of values) {
    wsManager.broadcast(universeId, logEntry);
  }

  return inserted;
}

export interface DeleteLogsFilters {
  olderThan: Date;
  level?: "info" | "warn" | "error";
  topic?: string;
}

/**
 * Remove logs do universo que atendem aos filtros.
 * @returns Número de linhas removidas.
 */
export async function deleteLogs(universeId: bigint, filters: DeleteLogsFilters): Promise<number> {
  const conditions = [eq(logs.universe_id, universeId), lt(logs.timestamp, filters.olderThan)];
  if (filters.level) conditions.push(eq(logs.level, filters.level));
  if (filters.topic) conditions.push(eq(logs.topic, filters.topic));

  const deleted = await db
    .delete(logs)
    .where(and(...conditions))
    .returning({ id: logs.id });

  return deleted.length;
}

export interface GetLogsCountFilters {
  from?: Date;
  to?: Date;
}

export interface LogsCountResult {
  total: number;
  byLevel: { info: number; warn: number; error: number };
}

/**
 * Retorna contagem total e por level, opcionalmente filtrada por intervalo de datas.
 */
export async function getLogsCount(
  universeId: bigint,
  filters: GetLogsCountFilters = {},
): Promise<LogsCountResult> {
  const baseConditions = [eq(logs.universe_id, universeId)];
  if (filters.from) baseConditions.push(sql`${logs.timestamp} >= ${filters.from}`);
  if (filters.to) baseConditions.push(sql`${logs.timestamp} <= ${filters.to}`);
  const whereClause = and(...baseConditions);

  const [totalRow] = await db.select({ count: count() }).from(logs).where(whereClause);

  const levelRows = await db
    .select({ level: logs.level, count: count() })
    .from(logs)
    .where(whereClause)
    .groupBy(logs.level);

  const byLevel: { info: number; warn: number; error: number } = {
    info: 0,
    warn: 0,
    error: 0,
  };
  for (const row of levelRows) {
    if (row.level === "info" || row.level === "warn" || row.level === "error") {
      byLevel[row.level] = Number(row.count);
    }
  }

  return {
    total: Number(totalRow?.count ?? 0),
    byLevel,
  };
}
