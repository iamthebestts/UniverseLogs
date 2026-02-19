/**
 * Serializa dados de entrada, convertendo tipos específicos para formatos serializáveis.
 *
 * - Valores `null` ou `undefined` são retornados como estão.
 * - Valores `bigint` são convertidos para string.
 * - Instâncias de `Date` são convertidas para string ISO.
 * - Arrays são serializados recursivamente.
 * - Objetos são serializados recursivamente, preservando chaves e valores.
 * - Outros tipos primitivos são retornados sem modificação.
 *
 * @template T - O tipo dos dados de entrada.
 * @param data - Os dados a serem serializados.
 * @returns Os dados serializados em um formato compatível com JSON ou similar.
 */
export function serialize<T>(data: T): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === "bigint") {
    return data.toString();
  }

  if (data instanceof Date) {
    return data.toISOString();
  }

  if (Array.isArray(data)) {
    return data.map((item) => serialize(item));
  }

  if (typeof data === "object") {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = serialize(value);
    }
    return result;
  }

  return data;
}
