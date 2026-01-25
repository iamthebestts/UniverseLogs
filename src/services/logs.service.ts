import { db } from "@/db/client";
import { games, logs } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export interface LogData {
  level: "info" | "warn" | "error";
  message: string;
  metadata?: unknown;
  topic?: string;
}

/**
 * Cria um log para um universo específico, garantindo que o universo exista na tabela de jogos.
 * Se o universo não existir, ele será criado automaticamente com um nome padrão.
 *
 * @param universeId - O ID do universo para o qual o log será criado.
 * @param data - Os dados do log, incluindo nível, mensagem, metadados e tópico.
 * @returns O log criado, incluindo o ID gerado.
 */
export async function createLog(universeId: bigint, data: LogData) {
  return db.transaction(async (tx) => {
    await tx
      .insert(games)
      .values({ universe_id: universeId, name: "Auto-created universe" })
      .onConflictDoNothing();

    const [log] = await tx
      .insert(logs)
      .values({
        universe_id: universeId,
        level: data.level,
        message: data.message,
        metadata: data.metadata,
        topic: data.topic,
      })
      .returning();

    return log;
  });
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
