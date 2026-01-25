import { db } from "@/db/client";
import { api_keys as apiKeys, games } from "@/db/schema";
import { and, count, eq } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";

function generateKey(): string {
  return randomBytes(32).toString("hex");
}

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// API Publica do Serviço


/**
 * Cria uma chave de API para o ID do universo fornecido.
 * Gera uma chave, calcula seu hash e a insere no banco de dados.
 * @param universeId - O ID do universo para o qual a chave de API será criada (bigint).
 * @returns Uma promessa que resolve para um objeto contendo a chave gerada.
 */
export async function createApiKey(universeId: bigint): Promise<{ key: string }> {
  const key = generateKey();
  const hash = hashKey(key);

  const [game] = await db
    .select()
    .from(games)
    .where(eq(games.universe_id, universeId))
    .limit(1);

  if (!game) {
    // Cria o tenant se não existir; usa nome genérico para evitar bloquear a operação.
    await db.insert(games).values({
      universe_id: universeId,
      name: "Auto-created universe",
    }).onConflictDoNothing();
  }

  await db.insert(apiKeys).values({
    universe_id: universeId,
    key: hash,
    is_active: true,
    created_at: new Date(),
    last_used_at: null,
    revoked_at: null,
  });

  return { key };
}

/**
 * Valida uma chave de API fornecida, verificando se ela existe e está ativa no banco de dados.
 * Se válida, atualiza o campo `last_used_at` e retorna o ID do universo associado.
 * Caso contrário, lança um Error.
 *
 * @param key - A chave de API a ser validada.
 * @returns Um objeto contendo o `universeId` se a chave for válida.
 * @throws Error quando a chave de API é inválida ou revogada.
 */
export async function validateApiKey(
  key: string
): Promise<{ universeId: bigint }> {
  const hash = hashKey(key);

  const [record] = await db
    .select()
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.key, hash),
        eq(apiKeys.is_active, true)
      )
    )
    .limit(1);

  if (!record) {
    throw new Error("API key inválida ou revogada");
  }

  await db
    .update(apiKeys)
    .set({ last_used_at: new Date() })
    .where(eq(apiKeys.id, record.id));

  return { universeId: record.universe_id };
}

/**
 * Obtém o ID de uma chave de API com base na chave fornecida, se estiver ativa.
 * 
 * Esta função calcula o hash da chave fornecida e consulta o banco de dados
 * para encontrar uma chave de API ativa correspondente. Se encontrada, retorna
 * o ID da chave; caso contrário, retorna null.
 * 
 * @param key - A chave de API em formato de string.
 * @returns Uma Promise que resolve para o ID da chave de API como string, ou null se não encontrada.
 */
export async function getIdByKey(key: string): Promise<string | null> {
  const hash = hashKey(key);

  const [record] = await db
    .select()
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.key, hash),
        eq(apiKeys.is_active, true)
      )
    )
    .limit(1);

  if (!record) {
    return null;
  }

  return record.id;
}

/**
 * Revoga uma chave de API pelo ID fornecido, marcando-a como inativa e definindo a data de revogação.
 * @param id - O ID da chave de API a ser revogada.
 * @returns Uma promessa que resolve para true se a revogação for bem-sucedida, false em caso de erro.
 */
export async function revokeKey(id: string): Promise<void> {
  try {
    await db.update(apiKeys).set({ is_active: false, revoked_at: new Date() }).where(eq(apiKeys.id, id));
  } catch (error) {
    throw new Error("Erro ao revogar a chave de API");
  }
}

export type ApiKeyMeta = {
  id: string;
  is_active: boolean;
  created_at: Date | null;
  last_used_at: Date | null;
  revoked_at: Date | null;
};

/**
 * Lista as chaves de API. Se universeId for fornecido, lista as chaves para esse universo.
 * Caso contrário, lista as chaves de todos os universos, sem incluir o hash de nenhuma chave.
 * @param universeId - Opcional: O ID do universo (bigint) para o qual listar as chaves de API.
 * @returns Uma promessa que resolve para uma lista de objetos com metadados das chaves.
 */
export async function listApiKeys(universeId?: bigint): Promise<Array<ApiKeyMeta>> {
  const query = universeId !== undefined
    ? db.select().from(apiKeys).where(eq(apiKeys.universe_id, universeId))
    : db.select().from(apiKeys);

  const records = await query;

  return records.map(record => ({
    id: record.id,
    is_active: record.is_active,
    created_at: record.created_at,
    last_used_at: record.last_used_at,
    revoked_at: record.revoked_at,
  }));
}
/**
 * Retorna a contagem de todas as chaves de API ativas.
 * @returns Uma promessa que resolve para o número de chaves de API ativas.
 */
export async function countActiveApiKeys(): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(apiKeys)
    .where(eq(apiKeys.is_active, true));

  return result.count;
}
