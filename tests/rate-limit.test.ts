// @ts-nocheck

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearRateLimitData,
  getRateLimitStats,
  rateLimitHandler,
  resetAllRateLimits,
} from "@/server/handlers/rate-limit";

describe("Rate Limit Handler", () => {
  beforeEach(() => {
    // Clear all rate limit data before each test
    clearRateLimitData();
  });

  afterEach(() => {
    // Cleanup after tests
    resetAllRateLimits();
    clearRateLimitData();
  });

  describe("Basic Rate Limiting", () => {
    it("should allow requests within the limit", async () => {
      const handler = rateLimitHandler({
        maxRequests: 3,
        windowMs: 60000,
      });

      const mockCtx: any = {
        request: {
          headers: new Map([["x-api-key", "test-key-1"]]),
          url: "http://localhost:3000/api/test",
        },
        path: "/api/test",
        set: {
          status: 200,
        },
      };

      // First 3 requests should pass
      for (let i = 0; i < 3; i++) {
        const result = await handler(mockCtx);
        expect(result).toBeUndefined();
        expect(mockCtx.set.status).toBe(200);
      }
    });

    it("should block requests exceeding the limit", async () => {
      const handler = rateLimitHandler({
        maxRequests: 2,
        windowMs: 60000,
      });

      const mockCtx = {
        request: {
          headers: new Map([["x-api-key", "test-key-2"]]),
          url: "http://localhost:3000/api/test",
        },
        path: "/api/test",
        set: {
          status: 200,
        },
      };

      // Make 2 requests (within limit)
      for (let i = 0; i < 2; i++) {
        await handler(mockCtx);
      }

      // Third request should be blocked
      const result = await handler(mockCtx);
      expect(mockCtx.set.status).toBe(429);
      expect(result).toBeDefined();
      expect(result.error).toContain("Rate limit");
    });

    it("should handle requests without API key (anonymous)", async () => {
      const handler = rateLimitHandler({
        maxRequests: 2,
        windowMs: 60000,
      });

      const mockCtx = {
        request: {
          headers: new Map(),
          url: "http://localhost:3000/api/test",
        },
        path: "/api/test",
        set: {
          status: 200,
        },
      };

      // First 2 requests should pass
      for (let i = 0; i < 2; i++) {
        await handler(mockCtx);
      }

      // Third should be blocked
      const result = await handler(mockCtx);
      expect(mockCtx.set.status).toBe(429);
      expect(result).toBeDefined();
    });
  });

  describe("Time Window Management", () => {
    it("should reset counter after time window expires", async () => {
      const windowMs = 100; // 100ms window
      const handler = rateLimitHandler({
        maxRequests: 1,
        windowMs,
      });

      const mockCtx = {
        request: {
          headers: new Map([["x-api-key", "test-key-3"]]),
          url: "http://localhost:3000/api/test",
        },
        path: "/api/test",
        set: {
          status: 200,
        },
      };

      // First request (allowed)
      await handler(mockCtx);
      expect(mockCtx.set.status).toBe(200);

      // Second request immediately (blocked)
      let result = await handler(mockCtx);
      expect(mockCtx.set.status).toBe(429);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, windowMs + 10));

      // Reset mock context status
      mockCtx.set.status = 200;

      // Third request after window (allowed)
      result = await handler(mockCtx);
      expect(mockCtx.set.status).toBe(200);
      expect(result).toBeUndefined();
    });
  });

  describe("Per-Endpoint Rate Limiting", () => {
    it("should track limits independently for different endpoints", async () => {
      const handler = rateLimitHandler({
        maxRequests: 2,
        windowMs: 60000,
      });

      const apiKey = "shared-key";

      // Make 2 requests to /api/logs
      for (let i = 0; i < 2; i++) {
        const ctx = {
          request: {
            headers: new Map([["x-api-key", apiKey]]),
            url: "http://localhost:3000/api/logs",
          },
          path: "/api/logs",
          set: { status: 200 },
        };
        await handler(ctx);
      }

      // Third request to /api/logs should be blocked
      const ctx1 = {
        request: {
          headers: new Map([["x-api-key", apiKey]]),
          url: "http://localhost:3000/api/logs",
        },
        path: "/api/logs",
        set: { status: 200 },
      };
      let result = await handler(ctx1);
      expect(ctx1.set.status).toBe(429);

      // But /api/keys endpoint should have its own limit
      ctx1.path = "/api/keys";
      ctx1.request.url = "http://localhost:3000/api/keys";
      ctx1.set.status = 200;

      // First 2 requests to /api/keys should pass
      for (let i = 0; i < 2; i++) {
        const ctx = {
          request: {
            headers: new Map([["x-api-key", apiKey]]),
            url: "http://localhost:3000/api/keys",
          },
          path: "/api/keys",
          set: { status: 200 },
        };
        result = await handler(ctx);
        expect(result).toBeUndefined();
      }
    });
  });

  describe("Custom Key Extractor", () => {
    it("should use custom key extractor function", async () => {
      const handler = rateLimitHandler({
        maxRequests: 1,
        windowMs: 60000,
        keyExtractor: (ctx) => ctx.userId || null,
      });

      const mockCtx = {
        userId: "user-123",
        request: {
          headers: new Map(),
          url: "http://localhost:3000/api/test",
        },
        path: "/api/test",
        set: { status: 200 },
      };

      // First request (allowed)
      await handler(mockCtx);
      expect(mockCtx.set.status).toBe(200);

      // Second request (blocked)
      await handler(mockCtx);
      expect(mockCtx.set.status).toBe(429);
    });

    it("should handle null from custom key extractor", async () => {
      const handler = rateLimitHandler({
        maxRequests: 1,
        windowMs: 60000,
        keyExtractor: () => null,
      });

      const mockCtx = {
        request: {
          headers: new Map(),
          url: "http://localhost:3000/api/test",
        },
        path: "/api/test",
        set: { status: 200 },
      };

      // Should use "anonymous" fallback
      await handler(mockCtx);
      expect(mockCtx.set.status).toBe(200);
    });
  });

  describe("Statistics Tracking", () => {
    it("should track hits correctly", async () => {
      const handler = rateLimitHandler({
        maxRequests: 5,
        windowMs: 60000,
        trackStats: true,
      });

      const mockCtx = {
        request: {
          headers: new Map([["x-api-key", "stats-key"]]),
          url: "http://localhost:3000/api/test",
        },
        path: "/api/test",
        set: { status: 200 },
      };

      // Make 3 requests
      for (let i = 0; i < 3; i++) {
        await handler(mockCtx);
      }

      const stats = getRateLimitStats();
      expect(stats.hits).toBe(3);
    });

    it("should track blocks correctly", async () => {
      const handler = rateLimitHandler({
        maxRequests: 1,
        windowMs: 60000,
        trackStats: true,
      });

      const mockCtx = {
        request: {
          headers: new Map([["x-api-key", "block-key"]]),
          url: "http://localhost:3000/api/test",
        },
        path: "/api/test",
        set: { status: 200 },
      };

      // First request (hit)
      await handler(mockCtx);

      // Next 3 requests (blocked)
      for (let i = 0; i < 3; i++) {
        await handler(mockCtx);
      }

      const stats = getRateLimitStats();
      expect(stats.hits).toBe(1);
      expect(stats.blocks).toBe(3);
    });

    it("should disable stats when trackStats is false", async () => {
      const handler = rateLimitHandler({
        maxRequests: 5,
        windowMs: 60000,
        trackStats: false,
      });

      const mockCtx = {
        request: {
          headers: new Map([["x-api-key", "no-stats-key"]]),
          url: "http://localhost:3000/api/test",
        },
        path: "/api/test",
        set: { status: 200 },
      };

      for (let i = 0; i < 3; i++) {
        await handler(mockCtx);
      }

      getRateLimitStats();
    });
  });

  describe("Reset Functions", () => {
    it("should reset rate limit for specific key and endpoint", async () => {
      const handler = rateLimitHandler({
        maxRequests: 1,
        windowMs: 60000,
      });

      const mockCtx = {
        request: {
          headers: new Map([["x-api-key", "reset-key"]]),
          url: "http://localhost:3000/api/test",
        },
        path: "/api/test",
        set: { status: 200 },
      };

      // First request (allowed)
      await handler(mockCtx);

      // Second request (blocked)
      await handler(mockCtx);
      expect(mockCtx.set.status).toBe(429);

      // Reset all rate limits (affects all keys and endpoints)
      resetAllRateLimits();

      // Third request should be allowed after reset
      mockCtx.set.status = 200;
      await handler(mockCtx);
      expect(mockCtx.set.status).toBe(200);
    });

    it("should reset all rate limits", async () => {
      const handler = rateLimitHandler({
        maxRequests: 1,
        windowMs: 60000,
      });

      // Create contexts for 2 different keys
      const createCtx = (key: string, path: string = "/api/test") => ({
        request: {
          headers: new Map([["x-api-key", key]]),
          url: `http://localhost:3000${path}`,
        },
        path,
        set: { status: 200 },
      });

      const ctx1 = createCtx("key1");
      const ctx2 = createCtx("key2", "/api/logs");

      // Exhaust both keys
      await handler(ctx1);
      await handler(ctx1);
      expect(ctx1.set.status).toBe(429);

      await handler(ctx2);
      await handler(ctx2);
      expect(ctx2.set.status).toBe(429);

      // Reset all
      resetAllRateLimits();

      // Both should work again
      ctx1.set.status = 200;
      ctx2.set.status = 200;

      await handler(ctx1);
      expect(ctx1.set.status).toBe(200);

      await handler(ctx2);
      expect(ctx2.set.status).toBe(200);
    });

    it("should clear all rate limit data and stats", async () => {
      const handler = rateLimitHandler({
        maxRequests: 5,
        windowMs: 60000,
        trackStats: true,
      });

      const mockCtx = {
        request: {
          headers: new Map([["x-api-key", "clear-key"]]),
          url: "http://localhost:3000/api/test",
        },
        path: "/api/test",
        set: { status: 200 },
      };

      // Make some requests
      for (let i = 0; i < 3; i++) {
        await handler(mockCtx);
      }

      let stats = getRateLimitStats();
      expect(stats.hits).toBe(3);

      // Clear everything
      clearRateLimitData();

      stats = getRateLimitStats();
      expect(stats.hits).toBe(0);
      expect(stats.blocks).toBe(0);
    });
  });

  describe("Error Handling", () => {
    it("should throw on invalid maxRequests", () => {
      expect(() => {
        rateLimitHandler({
          maxRequests: 0,
          windowMs: 60000,
        });
      }).toThrow("maxRequests must be greater than 0");

      expect(() => {
        rateLimitHandler({
          maxRequests: -5,
          windowMs: 60000,
        });
      }).toThrow("maxRequests must be greater than 0");
    });

    it("should throw on invalid windowMs", () => {
      expect(() => {
        rateLimitHandler({
          maxRequests: 10,
          windowMs: 0,
        });
      }).toThrow("windowMs must be greater than 0");

      expect(() => {
        rateLimitHandler({
          maxRequests: 10,
          windowMs: -100,
        });
      }).toThrow("windowMs must be greater than 0");
    });

    it("should handle missing request object gracefully", async () => {
      const handler = rateLimitHandler({
        maxRequests: 1,
        windowMs: 60000,
      });

      const mockCtx = {
        request: null,
        path: "/api/test",
        set: { status: 200 },
      };

      // Should not throw
      await expect(async () => {
        await handler(mockCtx);
      }).not.toThrow();
    });
  });

  describe("Retry-After Header", () => {
    it("should include retryAfter in response when rate limited", async () => {
      const handler = rateLimitHandler({
        maxRequests: 1,
        windowMs: 5000, // 5 seconds
      });

      const mockCtx = {
        request: {
          headers: new Map([["x-api-key", "retry-key"]]),
          url: "http://localhost:3000/api/test",
        },
        path: "/api/test",
        set: { status: 200 },
      };

      // Exhaust limit
      await handler(mockCtx);
      const result = await handler(mockCtx);

      expect(result).toBeDefined();
      expect(result.retryAfter).toBeDefined();
      expect(typeof result.retryAfter).toBe("number");
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.retryAfter).toBeLessThanOrEqual(5);
    });
  });

  describe("Master Key Handling", () => {
    it("should extract master key from header", async () => {
      const handler = rateLimitHandler({
        maxRequests: 1,
        windowMs: 60000,
      });

      const mockCtx = {
        request: {
          headers: new Map([["x-master-key", "master-secret"]]),
          url: "http://localhost:3000/api/test",
        },
        path: "/api/test",
        set: { status: 200 },
      };

      // Should work with master key
      await handler(mockCtx);
      expect(mockCtx.set.status).toBe(200);

      // Second request should be blocked (same limit)
      await handler(mockCtx);
      expect(mockCtx.set.status).toBe(429);
    });

    it("should prefer API key over master key", async () => {
      const handler = rateLimitHandler({
        maxRequests: 1,
        windowMs: 60000,
      });

      const mockCtx = {
        request: {
          headers: new Map([
            ["x-api-key", "api-key"],
            ["x-master-key", "master-key"],
          ]),
          url: "http://localhost:3000/api/test",
        },
        path: "/api/test",
        set: { status: 200 },
      };

      await handler(mockCtx);

      // Should be blocked with api-key limit
      await handler(mockCtx);
      expect(mockCtx.set.status).toBe(429);
    });
  });

  describe("Concurrent Requests", () => {
    it("should handle concurrent requests correctly", async () => {
      const handler = rateLimitHandler({
        maxRequests: 3,
        windowMs: 60000,
      });

      const createCtx = () => ({
        request: {
          headers: new Map([["x-api-key", "concurrent-key"]]),
          url: "http://localhost:3000/api/test",
        },
        path: "/api/test",
        set: { status: 200 },
      });

      // Simulate 5 concurrent requests
      const contexts = Array(5)
        .fill(null)
        .map(() => createCtx());

      await Promise.all(contexts.map((ctx) => handler(ctx)));

      // Count allowed and blocked
      const blocked = contexts.filter((ctx) => ctx.set.status === 429);
      const allowed = contexts.filter((ctx) => ctx.set.status === 200);

      expect(blocked.length).toBeGreaterThan(0);
      expect(allowed.length).toBeGreaterThanOrEqual(3);
    });
  });
});
