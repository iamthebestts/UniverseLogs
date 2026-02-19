import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 1. Mock modules that are safe to mock globally (or needed for everything here)
vi.mock("@/env", () => ({
  env: {
    NODE_ENV: "test",
    MASTER_KEY: "test-master-key",
    PORT: 0,
    DATABASE_URL: "postgres://mock",
  },
}));

import { db } from "@/db/client";
// 2. Import dependencies
import { buildApp } from "@/server/server";
import * as apiKeysService from "@/services/api-keys.service";
import * as logsService from "@/services/logs.service";

describe("Logs Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default spies for db to avoid hitting real DB if not specifically mocked
    vi.spyOn(db, "select").mockReturnThis();
    vi.spyOn(db, "insert").mockReturnThis();
    vi.spyOn(db, "update").mockReturnThis();
    vi.spyOn(db, "delete").mockReturnThis();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
        }),
      );
      expect(response.status).toBe(401);
    });

    it("should return 200 and create log with valid API key", async () => {
      const universeId = BigInt(123);
      vi.spyOn(apiKeysService, "validateApiKey").mockResolvedValue({ universeId });
      const createSpy = vi.spyOn(logsService, "createLog").mockResolvedValue({
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
        }),
      );

      expect(response.status).toBe(200);
      expect(createSpy).toHaveBeenCalledWith(universeId, {
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
      const response = await app.handle(new Request("http://localhost/api/logs/123"));
      expect(response.status).toBe(401);
    });

    it("should return 200 and return log if found", async () => {
      const universeId = BigInt(123);
      const logId = "log-123";
      vi.spyOn(apiKeysService, "validateApiKey").mockResolvedValue({ universeId });
      const getByIdSpy = vi.spyOn(logsService, "getLogById").mockResolvedValue({
        id: logId,
        universe_id: universeId,
        level: "info",
        message: "Found me",
      } as any);

      const app = await buildApp();
      const response = await app.handle(
        new Request(`http://localhost/api/logs/${logId}`, {
          headers: { "x-api-key": "valid-key" },
        }),
      );

      expect(response.status).toBe(200);
      expect(getByIdSpy).toHaveBeenCalledWith(logId, universeId);
    });

    it("should return 404 if log not found", async () => {
      const universeId = BigInt(123);
      vi.spyOn(apiKeysService, "validateApiKey").mockResolvedValue({ universeId });
      vi.spyOn(logsService, "getLogById").mockResolvedValue(null);

      const app = await buildApp();
      const response = await app.handle(
        new Request(`http://localhost/api/logs/not-found`, {
          headers: { "x-api-key": "valid-key" },
        }),
      );

      expect(response.status).toBe(404);
    });
  });

  describe("GET /api/logs", () => {
    it("should return 401 without API key", async () => {
      const app = await buildApp();
      const response = await app.handle(new Request("http://localhost/api/logs"));
      expect(response.status).toBe(401);
    });

    it("should return 200 and list logs with filters", async () => {
      const universeId = BigInt(123);
      vi.spyOn(apiKeysService, "validateApiKey").mockResolvedValue({ universeId });
      const listSpy = vi.spyOn(logsService, "listLogs").mockResolvedValue([
        {
          id: "log-1",
          universe_id: universeId,
          level: "info",
          message: "Test",
          metadata: {},
          topic: null,
          timestamp: new Date(),
        } as any,
      ]);

      const app = await buildApp();
      const response = await app.handle(
        new Request("http://localhost/api/logs?level=info&topic=test&limit=10", {
          headers: { "x-api-key": "valid-key" },
        }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.logs).toHaveLength(1);
      expect(listSpy).toHaveBeenCalledWith(
        universeId,
        expect.objectContaining({
          level: "info",
          topic: "test",
          limit: 10,
        }),
      );
    });
  });

  describe("GET /api/logs/count", () => {
    it("should return 200 and count", async () => {
      const universeId = BigInt(123);
      vi.spyOn(apiKeysService, "validateApiKey").mockResolvedValue({ universeId });
      const countSpy = vi.spyOn(logsService, "getLogsCount").mockResolvedValue({
        total: 42,
        byLevel: { info: 30, warn: 8, error: 4 },
      });

      const app = await buildApp();
      const response = await app.handle(
        new Request("http://localhost/api/logs/count", {
          headers: { "x-api-key": "valid-key" },
        }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.total).toBe(42);
      expect(body.byLevel.info).toBe(30);
      expect(countSpy).toHaveBeenCalled();
    });
  });

  describe("POST /api/logs/bulk", () => {
    it("should return 200 and create logs in bulk", async () => {
      const universeId = BigInt(123);
      vi.spyOn(apiKeysService, "validateApiKey").mockResolvedValue({ universeId });
      const bulkSpy = vi.spyOn(logsService, "createLogsBulk").mockResolvedValue([
        {
          id: "bulk-1",
          universe_id: universeId,
          level: "info",
          message: "Bulk 1",
          metadata: {},
          topic: null,
          timestamp: new Date(),
        } as any,
        {
          id: "bulk-2",
          universe_id: universeId,
          level: "warn",
          message: "Bulk 2",
          metadata: {},
          topic: null,
          timestamp: new Date(),
        } as any,
      ]);

      const app = await buildApp();
      const response = await app.handle(
        new Request("http://localhost/api/logs/bulk", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": "valid-key",
          },
          body: JSON.stringify({
            logs: [
              { level: "info", message: "Bulk 1" },
              { level: "warn", message: "Bulk 2" },
            ],
          }),
        }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.logs).toHaveLength(2);
      expect(bulkSpy).toHaveBeenCalledWith(
        universeId,
        expect.arrayContaining([
          expect.objectContaining({ level: "info", message: "Bulk 1" }),
          expect.objectContaining({ level: "warn", message: "Bulk 2" }),
        ]),
      );
    });
  });

  describe("DELETE /api/logs", () => {
    it("should return 200 and deleted count", async () => {
      const universeId = BigInt(123);
      vi.spyOn(apiKeysService, "validateApiKey").mockResolvedValue({ universeId });
      const deleteSpy = vi.spyOn(logsService, "deleteLogs").mockResolvedValue(5);

      const app = await buildApp();
      const response = await app.handle(
        new Request("http://localhost/api/logs?olderThan=2025-01-01T00:00:00.000Z", {
          method: "DELETE",
          headers: { "x-api-key": "valid-key" },
        }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.deleted).toBe(5);
      expect(deleteSpy).toHaveBeenCalledWith(
        universeId,
        expect.objectContaining({ olderThan: expect.any(Date) }),
      );
    });
  });
});
