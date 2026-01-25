/**
 * Test utilities and helpers for vitest
 */

import { expect, vi } from "vitest";

/**
 * Mock context factory for creating Elysia-like contexts
 */
export function createMockContext(overrides?: Partial<any>) {
  return {
    request: {
      headers: new Map(),
      url: "http://localhost:3000/api/test",
      method: "GET",
    },
    path: "/api/test",
    set: {
      status: 200,
      headers: {},
    },
    headers: new Map(),
    ...overrides,
  };
}

/**
 * Creates a mock request with headers
 */
export function createMockRequest(
  url: string = "http://localhost:3000/api/test",
  headers?: Record<string, string>
) {
  const headerMap = new Map(Object.entries(headers || {}));
  return {
    headers: headerMap,
    url,
    method: "GET",
  };
}

/**
 * Helper to wait for async operations in tests
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Helper to assert error response format
 */
export function assertErrorResponse(response: any) {
  if (!response) return;

  if (response.error) {
    // Simple error format
    expect(response.error).toBeDefined();
    if (response.retryAfter) {
      expect(typeof response.retryAfter).toBe("number");
    }
  } else if (response.code) {
    // ApiError format
    expect(response.code).toBeDefined();
    expect(response.message).toBeDefined();
    expect(response.statusCode).toBeDefined();
    expect(response.timestamp).toBeDefined();
  }
}

/**
 * Helper to get auth header from context
 */
export function extractAuthHeader(ctx: any): string | null {
  if (ctx.request?.headers instanceof Map) {
    return (
      (ctx.request.headers.get("x-api-key") as string) ||
      (ctx.request.headers.get("x-master-key") as string) ||
      null
    );
  }
  return null;
}

/**
 * Setup and teardown helpers
 */
export const testSetup = {
  /**
   * Reset environment for each test
   */
  beforeEach: () => {
    // Clear any cached data
    vi.clearAllMocks?.();
  },

  /**
   * Cleanup after each test
   */
  afterEach: () => {
    vi.clearAllMocks?.();
  },
};

/**
 * Generate realistic test data
 */
export const testData = {
  /**
   * Generate a random API key
   */
  generateApiKey: (): string => {
    return `key_${Math.random().toString(36).substr(2, 32)}`;
  },

  /**
   * Generate a random request ID
   */
  generateRequestId: (): string => {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Generate a random path
   */
  generatePath: (): string => {
    const paths = ["/api/logs", "/api/keys", "/api/health", "/api/users"];
    return paths[Math.floor(Math.random() * paths.length)];
  },

  /**
   * Generate realistic error details
   */
  generateErrorDetails: () => ({
    field: "email",
    pattern: "user@domain",
    maxLength: 100,
  }),
};

/**
 * Assertion helpers
 */
export const assertions = {
  /**
   * Assert that a value is a valid HTTP status code
   */
  isValidStatusCode: (status: number) => {
    expect(status).toBeGreaterThanOrEqual(100);
    expect(status).toBeLessThan(600);
  },

  /**
   * Assert that a value is a valid ISO timestamp
   */
  isValidTimestamp: (timestamp: string) => {
    expect(() => new Date(timestamp)).not.toThrow();
    expect(new Date(timestamp).getTime()).toBeGreaterThan(0);
  },

  /**
   * Assert retry after is reasonable
   */
  isValidRetryAfter: (retryAfter: number) => {
    expect(typeof retryAfter).toBe("number");
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(3600); // 1 hour max
  },
};

/**
 * Performance testing helpers
 */
export const perfUtils = {
  /**
   * Measure execution time of an async function
   */
  async measureTime<T>(
    fn: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    const start = globalThis.performance.now();
    const result = await fn();
    const duration = globalThis.performance.now() - start;
    return { result, duration };
  },

  /**
   * Assert that execution is fast enough
   */
  assertFastExecution: (duration: number, maxMs: number = 100) => {
    expect(duration).toBeLessThan(maxMs);
  },
};
