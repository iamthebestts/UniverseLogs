/**
 * Utilitários para parsing de dados de entrada
 */

/**
 * Converte um valor (string ou número) para BigInt de forma segura.
 * Especialmente útil para IDs de universos Roblox que podem exceder Number.MAX_SAFE_INTEGER.
 *
 * @param value - O valor a ser convertido
 * @returns O BigInt resultante ou null se o valor for inválido
 */
export const parseUniverseId = (value: unknown): bigint | null => {
  if (typeof value === "bigint") return value;

  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value)) return null;
    return BigInt(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return BigInt(trimmed);
    } catch {
      return null;
    }
  }

  return null;
};
