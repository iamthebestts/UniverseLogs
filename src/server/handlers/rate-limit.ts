import { MemoryCache } from "@/core/cache";
import type { Handler } from "elysia";

/**
 * Rate limit statistics for monitoring and debugging
 */
export interface RateLimitStats {
  hits: number;
  blocks: number;
  expirations: number;
}

/**
 * Configuration options for rate limiting
 */
export interface RateLimitOptions {
  /** Maximum number of requests allowed within the time window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Optional: Enable statistics tracking (default: true) */
  trackStats?: boolean;
  /** Optional: Custom key extraction function (defaults to API key from header) */
  keyExtractor?: (ctx: any) => string | null;
}

/**
 * Rate limit entry stored in cache
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Global cache instance for storing rate limit data
 * Using a single cache instance with appropriate TTL for efficient memory usage
 */
const rateLimitCache = new MemoryCache<RateLimitEntry>(
  5 * 60 * 1000, // 5 minutes default TTL
  10000, // Support up to 10k concurrent tracked keys
  true, // Enable cleanup timer
  5, // Evict 5 items at a time when full
);

/**
 * Global statistics tracker for all rate limit handlers
 * Tracks hits and blocks across all instances
 */
const globalStats = {
  hits: 0,
  blocks: 0,
};

/**
 * Creates a rate limit handler for Elysia routes
 * Uses MemoryCache (L1) for efficient local storage
 *
 * @param options - Rate limit configuration
 * @returns Elysia handler function that enforces rate limits
 *
 * @example
 * ```typescript
 * // Apply to a route
 * app.post("/api/logs", {
 *   beforeHandle: rateLimitHandler({ maxRequests: 100, windowMs: 60000 }),
 *   handler: async (ctx) => { ... }
 * })
 *
 * // Different limit per route
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
 * Extracts the authentication key from the request context
 * Checks both x-api-key and x-master-key headers
 *
 * @param ctx - Elysia request context
 * @returns The authentication key or null if not found
 */
function extractAuthKey(ctx: any): string | null {
  try {
    // Try to get from Elysia context headers
    const headers = ctx.request?.headers || ctx.headers || {};

    // Check for API key
    const apiKey = headers["x-api-key"];
    if (apiKey) {
      return Array.isArray(apiKey) ? apiKey[0] : apiKey;
    }

    // Check for Master key
    const masterKey = headers["x-master-key"];
    if (masterKey) {
      return Array.isArray(masterKey) ? masterKey[0] : masterKey;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Resets the rate limit counter for a specific API key
 * Useful for admin operations or testing
 *
 * @param authKey - The authentication key to reset
 */
export function resetRateLimit(authKey: string): void {
  const cacheKey = `ratelimit:${authKey}`;
  rateLimitCache.delete(cacheKey);
}

/**
 * Resets all rate limit counters
 * Use with caution - clears all stored rate limit data
 */
export function resetAllRateLimits(): void {
  // We'll create a new cache instance to clear everything
  // This is more efficient than iterating through all keys
  rateLimitCache.clear();
}

/**
 * Gets rate limit statistics for the current session
 *
 * @returns Object containing hits, blocks, and cache statistics
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
 * Clears all rate limit data and statistics
 */
export function clearRateLimitData(): void {
  resetAllRateLimits();
  globalStats.hits = 0;
  globalStats.blocks = 0;
}

/**
 * Creates a rate limit handler with a custom key extractor
 * Useful when you need to rate limit by something other than API key
 * (e.g., by IP address, user ID, or custom identifier)
 *
 * @param options - Rate limit configuration with custom keyExtractor
 * @returns Elysia handler function
 *
 * @example
 * ```typescript
 * // Rate limit by IP address
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
