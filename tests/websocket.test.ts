import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock das dependências pesadas
vi.mock("@/db/client", () => ({ db: {} }));
vi.mock("@/services/api-keys.service", () => ({ validateApiKey: vi.fn() }));
vi.mock("@/services/logs.service", () => ({ createLog: vi.fn() }));
vi.mock("@/services/universes.service", () => ({ listUniverseLogs: vi.fn() }));

import { wsManager, type WSLike } from "@/server/websocket/manager";
import { registerRealtime } from "@/server/websocket/realtime.ws";
import { validateApiKey } from "@/services/api-keys.service";

describe("WebSocket System", () => {
  let mockWS: WSLike;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWS = {
      send: vi.fn(),
      close: vi.fn(),
      data: { headers: {} }
    } as any;
  });

  describe("WebSocket Manager", () => {
    it("should manage connections by universeId", () => {
      const universeId = BigInt(123);
      wsManager.add(universeId, mockWS);
      expect(mockWS.data.universeId).toBe(universeId);
      
      const payload = { hello: "world" };
      wsManager.broadcast(universeId, payload);
      expect(mockWS.send).toHaveBeenCalled();
      
      wsManager.remove(mockWS);
    });
  });

  describe("Realtime Route Logic", () => {
    it("should reject connection without API key", async () => {
      const app = { ws: vi.fn() } as any;
      registerRealtime(app);
      
      const wsOptions = app.ws.mock.calls[0][1];
      await wsOptions.open(mockWS);
      
      expect(mockWS.close).toHaveBeenCalled();
      expect(mockWS.send).toHaveBeenCalledWith(expect.objectContaining({ type: "ERROR" }));
    });

    it("should accept valid API key and register in manager", async () => {
      const universeId = BigInt(456);
      (validateApiKey as any).mockResolvedValue({ universeId });
      (mockWS.data as any).headers["x-api-key"] = "valid-key";
      
      const app = { ws: vi.fn() } as any;
      registerRealtime(app);
      const wsOptions = app.ws.mock.calls[0][1];
      
      await wsOptions.open(mockWS);
      
      expect(mockWS.send).toHaveBeenCalledWith(expect.objectContaining({ type: "CONNECTED", universeId: universeId.toString() }));
    });
  });
});
