import { MemoryCache } from "@/core/cache";
import type { Handler } from "elysia";

/**
 * Estatísticas de limite de taxa para monitoramento e depuração
 */
export interface RateLimitStats {
  hits: number;
  blocks: number;
  expirations: number;
}

/**
 * Opções de configuração para limite de taxa
 */
export interface RateLimitOptions {
  /** Número máximo de solicitações permitidas dentro da janela de tempo */
  maxRequests: number;
  /** Janela de tempo em milissegundos */
  windowMs: number;
  /** Opcional: Habilitar rastreamento de estatísticas (padrão: true) */
  trackStats?: boolean;
  /** Opcional: Função personalizada de extração de chave (padrão para chave de API do cabeçalho) */
  keyExtractor?: (ctx: any) => string | null;
}

/**
 * Entrada de limite de taxa armazenada no cache
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Instância global de cache para armazenar dados de limite de taxa
 * Usando uma única instância de cache com TTL apropriado para uso eficiente de memória
 */
const rateLimitCache = new MemoryCache<RateLimitEntry>(
  5 * 60 * 1000, // 5 minutos de TTL padrão
  10000, // Suporte até 10k chaves simultâneas rastreadas
  true, // Habilitar timer de limpeza
  5, // Evitar 5 itens por vez quando cheio
);

/**
 * Rastreador global de estatísticas para todos os manipuladores de limite de taxa
 * Rastreia hits e blocks em todas as instâncias
 */
const globalStats = {
  hits: 0,
  blocks: 0,
};

/**
 * Cria um manipulador de limite de taxa para rotas Elysia
 * Usa MemoryCache (L1) para armazenamento local eficiente
 *
 * @param options - Configuração do limite de taxa
 * @returns Função manipuladora do Elysia que impõe limites de taxa
 *
 * @example
 * ```typescript
 * // Aplicar a uma rota
 * app.post("/api/logs", {
 *   beforeHandle: rateLimitHandler({ maxRequests: 100, windowMs: 60000 }),
 *   handler: async (ctx) => { ... }
 * })
 *
 * // Limite diferente por rota
 * app.get("/api/expensive", {
 *   beforeHandle: rateLimitHandler({ maxRequests: 10, windowMs: 60000 }),
 *   handler: async (ctx) => { ... }
 * })
 * ```
 */
export function rateLimitHandler(options: RateLimitOptions): Handler {
  const {
    maxRequests,
    windowMs,
    trackStats = true,
    keyExtractor,
  } = options;

  // Validate options
  if (maxRequests <= 0) {
    throw new Error("maxRequests must be greater than 0");
  }
  if (windowMs <= 0) {
    throw new Error("windowMs must be greater than 0");
  }

  return async (ctx: any) => {
    // Extract authentication key from context
    const authKey = keyExtractor?.(ctx) ?? extractAuthKey(ctx);

    // If no auth key found, use a default key for rate limiting
    const rateLimitKey = authKey || "anonymous";

    // Create a unique cache key for this auth key + endpoint combination
    // This allows different endpoints to have different rate limits for the same API key
    const endpointIdentifier = (() => {
      if (typeof ctx?.path === "string" && ctx.path.length > 0) {
        return ctx.path;
      }
      try {
        return new URL(ctx.request.url).pathname;
      } catch {
        return "unknown";
      }
    })();

    const cacheKey = `ratelimit:${rateLimitKey}:${endpointIdentifier}`;
    const now = Date.now();

    // Retrieve or initialize the rate limit entry
    let entry = rateLimitCache.get(cacheKey);

    // If entry doesn't exist or has expired, create a new one
    if (!entry) {
      entry = {
        count: 1,
        resetAt: now + windowMs,
      };
      rateLimitCache.set(cacheKey, entry, { ttl: windowMs });

      if (trackStats) {
        globalStats.hits++;
      }

      return; // Continue to handler
    }

    // Check if the window has expired
    if (now >= entry.resetAt) {
      // Reset the counter and window
      entry = {
        count: 1,
        resetAt: now + windowMs,
      };
      rateLimitCache.set(cacheKey, entry, { ttl: windowMs });

      if (trackStats) {
        globalStats.hits++;
      }

      return; // Continue to handler
    }

    // Increment the counter
    entry.count++;

    // Update the entry in cache (keep original resetAt and TTL)
    const remainingTtl = entry.resetAt - now;
    if (remainingTtl > 0) {
      rateLimitCache.set(cacheKey, entry, { ttl: remainingTtl });
    }

    // Check if limit exceeded
    if (entry.count > maxRequests) {
      if (trackStats) {
        globalStats.blocks++;
      }

      const resetInSeconds = Math.ceil((entry.resetAt - now) / 1000);
      ctx.set.status = 429;
      return {
        error: `Rate limit excedido. Tente novamente em ${resetInSeconds} segundos`,
        retryAfter: resetInSeconds,
      };
    }

    if (trackStats) {
      globalStats.hits++;
    }
  };
}

/**
 * Extrai a chave de autenticação do contexto da solicitação
 * Verifica os cabeçalhos x-api-key e x-master-key
 *
 * @param ctx - Contexto da solicitação Elysia
 * @returns A chave de autenticação ou null se não encontrada
 */
function extractAuthKey(ctx: any): string | null {
  try {
    // Check for API key in headers
    const apiKey = ctx.request.headers.get("x-api-key");
    if (apiKey) return apiKey;

    // Check for Master key in headers
    const masterKey = ctx.request.headers.get("x-master-key");
    if (masterKey) return masterKey;

    return null;
  } catch {
    return null;
  }
}

/**
 * Redefine o contador de limite de taxa para uma chave de API específica
 * Útil para operações administrativas ou testes
 *
 * @param authKey - A chave de autenticação a ser redefinida
 */
export function resetRateLimit(authKey: string): void {
  const cacheKey = `ratelimit:${authKey}`;
  rateLimitCache.delete(cacheKey);
}

/**
 * Redefine todos os contadores de limite de taxa
 * Use com cautela - limpa todos os dados de limite de taxa armazenados
 */
export function resetAllRateLimits(): void {
  // We'll create a new cache instance to clear everything
  // This is more efficient than iterating through all keys
  rateLimitCache.clear();
}

/**
 * Obtém estatísticas de limite de taxa para a sessão atual
 *
 * @returns Objeto contendo hits, blocks e estatísticas de cache
 */
export function getRateLimitStats(): RateLimitStats & { cacheStats: any } {
  return {
    hits: globalStats.hits,
    blocks: globalStats.blocks,
    expirations: 0, // Can be extended to track from cache stats
    cacheStats: rateLimitCache.stats(),
  };
}

/**
 * Limpa todos os dados de limite de taxa e estatísticas
 */
export function clearRateLimitData(): void {
  resetAllRateLimits();
  globalStats.hits = 0;
  globalStats.blocks = 0;
}

/**
 * Cria um manipulador de limite de taxa com um extrator de chave personalizado
 * Útil quando você precisa limitar a taxa por algo diferente da chave de API
 * (ex.: por endereço IP, ID de usuário ou identificador personalizado)
 *
 * @param options - Configuração de limite de taxa com keyExtractor personalizado
 * @returns Função manipuladora do Elysia
 *
 * @example
 * ```typescript
 * // Limite de taxa baseado em IP
 * const ipBasedLimit = rateLimitHandler({
 *   maxRequests: 100,
 *   windowMs: 60000,
 *   keyExtractor: (ctx) => ctx.ip || ctx.request?.ip,
 * })
 * ```
 */
export function createRateLimitHandler(
  options: RateLimitOptions,
): Handler {
  return rateLimitHandler(options);
}
