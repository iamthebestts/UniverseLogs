import { beforeEach, describe, expect, it, vi } from "vitest";

// 1. Mock modules BEFORE importing anything else
vi.mock("@/env", () => ({
  env: {
    USE_AUTH: true,
    MASTER_KEY: "test-master-key",
    PORT: 0,
    DATABASE_URL: "postgres://mock",
  },
}));

// Mock the service used by api-keys.route.ts to prevent DB calls
vi.mock("@/services/api-keys.service", () => ({
  validateApiKey: vi.fn(),
  revokeKey: vi.fn(),
  createApiKey: vi.fn(),
  getIdByKey: vi.fn(),
  listApiKeys: vi.fn(),
  countActiveApiKeys: vi.fn().mockResolvedValue(0),
}));

// 2. Import dependencies
import { env } from "@/env";
import { buildApp } from "@/server/server";
import { countActiveApiKeys, validateApiKey } from "@/services/api-keys.service";

describe("Authentication System", () => {
  // Reset mocks and env before each test
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    env.USE_AUTH = true;
    env.MASTER_KEY = "test-master-key";
  });

  describe("When USE_AUTH is TRUE", () => {
    it("should return 401 for /internal routes without x-master-key", async () => {
      const app = await buildApp();
      const response = await app.handle(new Request("http://localhost/internal/keys/count"));
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body).toEqual({ error: "Invalid master key" });
    });

    it("should return 401 for /internal routes with invalid x-master-key", async () => {
      const app = await buildApp();
      const response = await app.handle(new Request("http://localhost/internal/keys/count", {
        headers: { "x-master-key": "invalid-key" }
      }));
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body).toEqual({ error: "Invalid master key" });
    });

    it("should return 200 for /internal routes with valid x-master-key", async () => {
      // Mock the service response
      vi.mocked(countActiveApiKeys).mockResolvedValue(5);

      const app = await buildApp();
      const response = await app.handle(new Request("http://localhost/internal/keys/count", {
        headers: { "x-master-key": "test-master-key" }
      }));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ count: 5 });
    });

    it("should return 401 for /api routes without x-api-key", async () => {
      const app = await buildApp();
      const response = await app.handle(new Request("http://localhost/api/health"));
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body).toEqual({ error: "Missing API key" });
    });

    it("should return 401 for /api routes with OUTDATED/INVALID x-api-key (service throws)", async () => {
      vi.mocked(validateApiKey).mockRejectedValue(new Error("API key inválida ou revogada"));

      const app = await buildApp();
      const response = await app.handle(new Request("http://localhost/api/health", {
        headers: { "x-api-key": "invalid-key" }
      }));

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body).toEqual({ error: "Invalid API key" });
    });

    it("should return 200 for /api routes with VALID x-api-key", async () => {
      vi.mocked(validateApiKey).mockResolvedValue({ universeId: BigInt(123) });

      const app = await buildApp();
      const response = await app.handle(new Request("http://localhost/api/health", {
        headers: { "x-api-key": "valid-key" }
      }));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ status: "ok" });
    });
  });

  describe("When USE_AUTH is FALSE", () => {
    beforeEach(() => {
      env.USE_AUTH = false;
    });

    it("should allow /internal routes WITHOUT key", async () => {
      vi.mocked(countActiveApiKeys).mockResolvedValue(10);

      const app = await buildApp();
      const response = await app.handle(new Request("http://localhost/internal/keys/count"));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ count: 10 });
    });

    it("should allow /api routes WITHOUT key", async () => {
      const app = await buildApp();
      const response = await app.handle(new Request("http://localhost/api/health"));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ status: "ok" });
    });
  });
});
