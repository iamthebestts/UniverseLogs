import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// 1. Mock modules
vi.mock("@/env", () => ({
  env: {
    USE_AUTH: true,
    MASTER_KEY: "test-master-key",
    PORT: 0,
    DATABASE_URL: "postgres://mock",
  },
}));

vi.mock("@/services/api-keys.service", () => ({
  validateApiKey: vi.fn(),
  revokeKey: vi.fn(),
  createApiKey: vi.fn(),
  getIdByKey: vi.fn(),
  listApiKeys: vi.fn(),
  countActiveApiKeys: vi.fn().mockResolvedValue(0),
}));

vi.mock("@/services/logs.service", () => ({
  createLog: vi.fn(),
  getLogById: vi.fn(),
}));

// 2. Import dependencies
import { buildApp } from "@/server/server";
import { validateApiKey } from "@/services/api-keys.service";
import { createLog, getLogById } from "@/services/logs.service";

// Cast to Mock for type safety
const mockValidateApiKey = validateApiKey as Mock;
const mockCreateLog = createLog as Mock;
const mockGetLogById = getLogById as Mock;

describe("Logs Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/logs", () => {
    it("should return 401 without API key", async () => {
      const app = await buildApp();
      const response = await app.handle(
        new Request("http://localhost/api/logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            level: "info",
            message: "Test log",
          }),
        })
      );
      expect(response.status).toBe(401);
    });

    it("should return 200 and create log with valid API key", async () => {
      const universeId = BigInt(123);
      mockValidateApiKey.mockResolvedValue({ universeId });
      mockCreateLog.mockResolvedValue({
        id: "log-id",
        universe_id: universeId,
        level: "info",
        message: "Test log",
        metadata: {},
        topic: null,
        timestamp: new Date(),
      });

      const app = await buildApp();
      const response = await app.handle(
        new Request("http://localhost/api/logs", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": "valid-key",
          },
          body: JSON.stringify({
            level: "info",
            message: "Test log",
            topic: "test-topic",
          }),
        })
      );

      expect(response.status).toBe(200);
      expect(mockCreateLog).toHaveBeenCalledWith(universeId, {
        level: "info",
        message: "Test log",
        metadata: undefined,
        topic: "test-topic",
      });
    });
  });

  describe("GET /api/logs/:id", () => {
    it("should return 401 without API key", async () => {
      const app = await buildApp();
      const response = await app.handle(
        new Request("http://localhost/api/logs/123")
      );
      expect(response.status).toBe(401);
    });

    it("should return 200 and return log if found", async () => {
      const universeId = BigInt(123);
      const logId = "log-123";
      mockValidateApiKey.mockResolvedValue({ universeId });
      mockGetLogById.mockResolvedValue({
        id: logId,
        universe_id: universeId,
        level: "info",
        message: "Found me",
      });

      const app = await buildApp();
      const response = await app.handle(
        new Request(`http://localhost/api/logs/${logId}`, {
          headers: { "x-api-key": "valid-key" },
        })
      );

      expect(response.status).toBe(200);
      expect(mockGetLogById).toHaveBeenCalledWith(logId, universeId);
    });

    it("should return 404 if log not found", async () => {
      const universeId = BigInt(123);
      mockValidateApiKey.mockResolvedValue({ universeId });
      mockGetLogById.mockResolvedValue(null);

      const app = await buildApp();
      const response = await app.handle(
        new Request(`http://localhost/api/logs/not-found`, {
          headers: { "x-api-key": "valid-key" },
        })
      );

      expect(response.status).toBe(404);
    });
  });
});
