import { and, eq } from "drizzle-orm";
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
