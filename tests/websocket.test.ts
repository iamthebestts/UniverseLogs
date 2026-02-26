import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { db } from "@/db/client";
import { type WSLike, wsManager } from "@/server/websocket/manager";
import { registerRealtime } from "@/server/websocket/realtime.ws";
import * as apiKeysService from "@/services/api-keys.service";
import * as logsService from "@/services/logs.service";

vi.mock("@/env", () => ({
  env: {
    NODE_ENV: "test",
    MASTER_KEY: "test-master-key",
    DATABASE_URL: "postgres://mock",
    PORT: 0,
  },
}));

type MockApp = { ws: ReturnType<typeof vi.fn> };

const getWsOptions = (app: MockApp) => {
  const firstCall = app.ws.mock.calls[0];
  expect(firstCall).toBeDefined();
  const wsOptions = firstCall?.[1];
  expect(wsOptions).toBeDefined();
  return wsOptions as {
    open: (ws: WSLike) => Promise<void>;
    message: (...args: any[]) => Promise<void>;
  };
};

describe("WebSocket System", () => {
  let mockWS: WSLike & { data: Record<string, any>; send: Mock; close: Mock };

  beforeEach(() => {
    vi.clearAllMocks();
    mockWS = {
      send: vi.fn(),
      close: vi.fn(),
      data: { headers: {} },
    } as any;

    // Use spies for services instead of vi.mock
    vi.spyOn(apiKeysService, "validateApiKey").mockResolvedValue({ universeId: BigInt(1) });
    vi.spyOn(logsService, "createLog").mockResolvedValue({ id: "1" } as any);
    vi.spyOn(logsService, "createLogsBulk").mockResolvedValue([]);
    vi.spyOn(logsService, "deleteLogs").mockResolvedValue(0);
    vi.spyOn(logsService, "getLogsCount").mockResolvedValue({
      total: 0,
      byLevel: { info: 0, warn: 0, error: 0 },
    });
    vi.spyOn(logsService, "listLogs").mockResolvedValue([]);

    // Spy on DB instead of global mock
    vi.spyOn(db, "select").mockReturnThis();
    vi.spyOn(db, "insert").mockReturnThis();

    // Setup wsManager spies
    vi.spyOn(wsManager, "add").mockImplementation((universeId: bigint, ws: any) => {
      if (ws.data) ws.data.universeId = universeId;
    });
    vi.spyOn(wsManager, "remove").mockImplementation(() => {});
    vi.spyOn(wsManager, "broadcast").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("WebSocket Manager", () => {
    it("should manage connections by universeId", () => {
      const universeId = BigInt(123);
      wsManager.add(universeId, mockWS);
      expect(mockWS.data.universeId).toBe(universeId);

      const payload = { hello: "world" };
      wsManager.broadcast(universeId, payload);
      expect(wsManager.broadcast).toHaveBeenCalledWith(universeId, payload);

      wsManager.remove(mockWS);
      expect(wsManager.remove).toHaveBeenCalledWith(mockWS);
    });
  });

  describe("Realtime Route — connection", () => {
    it("should reject connection without API key", async () => {
      const app: MockApp = { ws: vi.fn() };
      registerRealtime(app as any);

      const wsOptions = getWsOptions(app);
      await wsOptions.open(mockWS);

      expect(mockWS.close).toHaveBeenCalled();
      expect(mockWS.send).toHaveBeenCalledWith(
        expect.objectContaining({ type: "ERROR", message: "Missing API key" }),
      );
    });

    it("should reject connection with invalid API key", async () => {
      vi.spyOn(apiKeysService, "validateApiKey").mockRejectedValue(new Error("Invalid"));
      mockWS.data.headers = { "x-api-key": "bad-key" };

      const app: MockApp = { ws: vi.fn() };
      registerRealtime(app as any);
      const wsOptions = getWsOptions(app);

      await wsOptions.open(mockWS);

      expect(mockWS.close).toHaveBeenCalled();
      expect(mockWS.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "ERROR",
          message: "Invalid API key",
        }),
      );
    });

    it("should accept valid API key and store universeId in ws.data", async () => {
      const universeId = BigInt(456);
      vi.spyOn(apiKeysService, "validateApiKey").mockResolvedValue({ universeId });
      mockWS.data.headers = {
        "x-api-key": "valid-key",
      };

      const app: MockApp = { ws: vi.fn() };
      registerRealtime(app as any);
      const wsOptions = getWsOptions(app);

      await wsOptions.open(mockWS);

      expect(mockWS.data.universeId).toBe(universeId);
      const sent = mockWS.send.mock.calls[0]?.[0];
      expect(sent).toBeDefined();
      expect(sent).toMatchObject({
        type: "CONNECTED",
      });
      expect(String(sent.universeId)).toBe("456");
    });
  });

  describe("Realtime Route — commands", () => {
    let app: MockApp;
    let wsOptions: any;

    beforeEach(() => {
      app = { ws: vi.fn() };
      registerRealtime(app as any);
      wsOptions = getWsOptions(app);
    });

    const openWithValidKey = async (universeId: bigint) => {
      vi.spyOn(apiKeysService, "validateApiKey").mockResolvedValue({ universeId });
      mockWS.data.headers = { "x-api-key": "valid-key" };
      await wsOptions.open(mockWS);
      mockWS.data.universeId = universeId;
    };

    it("QUERY_LOGS returns filtered result", async () => {
      await openWithValidKey(BigInt(1));
      vi.spyOn(logsService, "listLogs").mockResolvedValue([
        {
          id: "log-1",
          universe_id: BigInt(1),
          level: "info",
          message: "Hi",
          metadata: {},
          topic: "ws",
          timestamp: new Date(),
        } as any,
      ]);

      await wsOptions.message(
        mockWS,
        JSON.stringify({
          type: "QUERY_LOGS",
          payload: { level: "info", limit: 10 },
        }),
      );

      expect(logsService.listLogs).toHaveBeenCalledWith(
        BigInt(1),
        expect.objectContaining({ level: "info", limit: 10 }),
      );
      expect(mockWS.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "LOGS_QUERY_RESULT",
          logs: expect.any(Array),
        }),
      );
    });

    it("QUERY_LOGS_COUNT returns expected counts", async () => {
      await openWithValidKey(BigInt(1));
      vi.spyOn(logsService, "getLogsCount").mockResolvedValue({
        total: 10,
        byLevel: { info: 6, warn: 2, error: 2 },
      });

      await wsOptions.message(
        mockWS,
        JSON.stringify({
          type: "QUERY_LOGS_COUNT",
          payload: { from: "2025-01-01", to: "2025-01-31" },
        }),
      );

      expect(logsService.getLogsCount).toHaveBeenCalledWith(
        BigInt(1),
        expect.objectContaining({
          from: expect.any(Date),
          to: expect.any(Date),
        }),
      );
      expect(mockWS.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "LOGS_COUNT_RESULT",
          total: 10,
          byLevel: { info: 6, warn: 2, error: 2 },
        }),
      );
    });

    it("DELETE_LOGS deletes and returns count", async () => {
      await openWithValidKey(BigInt(1));
      vi.spyOn(logsService, "deleteLogs").mockResolvedValue(3);

      await wsOptions.message(
        mockWS,
        JSON.stringify({
          type: "DELETE_LOGS",
          payload: { olderThan: "2025-01-01T00:00:00.000Z", confirm: true },
        }),
      );

      expect(logsService.deleteLogs).toHaveBeenCalledWith(
        BigInt(1),
        expect.objectContaining({ olderThan: expect.any(Date) }),
      );
      expect(mockWS.send).toHaveBeenCalledWith(
        expect.objectContaining({ type: "LOGS_DELETED", deleted: 3 }),
      );
    });

    it("SEND_LOGS_BULK creates logs", async () => {
      await openWithValidKey(BigInt(1));
      vi.spyOn(logsService, "createLogsBulk").mockResolvedValue([
        {
          id: "b1",
          universe_id: BigInt(1),
          level: "info",
          message: "Bulk",
          metadata: {},
          topic: null,
          timestamp: new Date(),
        } as any,
      ]);

      await wsOptions.message(
        mockWS,
        JSON.stringify({
          type: "SEND_LOGS_BULK",
          payload: {
            logs: [{ level: "info", message: "Bulk" }],
          },
        }),
      );

      expect(logsService.createLogsBulk).toHaveBeenCalledWith(
        BigInt(1),
        expect.arrayContaining([expect.objectContaining({ level: "info", message: "Bulk" })]),
      );
      expect(mockWS.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "LOGS_BULK_CREATED",
          count: 1,
        }),
      );
    });

    it("invalid message returns ERROR", async () => {
      await openWithValidKey(BigInt(1));
      await wsOptions.message(mockWS, "not json");
      expect(mockWS.send).toHaveBeenCalledWith(
        expect.objectContaining({ type: "ERROR", message: "Invalid payload" }),
      );
    });

    it("unknown command returns ERROR", async () => {
      await openWithValidKey(BigInt(1));
      await wsOptions.message(mockWS, JSON.stringify({ type: "UNKNOWN_CMD" }));
      expect(mockWS.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "ERROR",
          message: "Unknown command",
        }),
      );
    });

    it("PING returns PONG", async () => {
      await openWithValidKey(BigInt(1));
      await wsOptions.message(mockWS, JSON.stringify({ type: "PING" }));
      expect(mockWS.send).toHaveBeenCalledWith(
        expect.objectContaining({ type: "PONG", timestamp: expect.any(String) }),
      );
    });

    it("SEND_LOG creates single log", async () => {
      await openWithValidKey(BigInt(1));
      vi.spyOn(logsService, "createLog").mockResolvedValue({
        id: "new-id",
        universe_id: BigInt(1),
        level: "info",
        message: "Single",
        metadata: {},
        topic: null,
        timestamp: new Date(),
      } as any);

      await wsOptions.message(
        mockWS,
        JSON.stringify({
          type: "SEND_LOG",
          payload: { level: "info", message: "Single" },
        }),
      );

      expect(logsService.createLog).toHaveBeenCalledWith(
        BigInt(1),
        expect.objectContaining({ level: "info", message: "Single" }),
      );
      expect(mockWS.send).toHaveBeenCalledWith(
        expect.objectContaining({ type: "LOG_CREATED", id: "new-id" }),
      );
    });
  });
});
