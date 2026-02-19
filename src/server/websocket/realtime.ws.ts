import { logger } from "@/core/logger";
import type { App } from "@/server/server";
import { type WSLike, wsManager } from "@/server/websocket/manager";
import { validateApiKey } from "@/services/api-keys.service";
import { createLog } from "@/services/logs.service";
import { listUniverseLogs } from "@/services/universes.service";
import { serialize } from "../utils/serialization";

export const registerRealtime = (app: App) => {
  app.ws("/realtime", {
    async open(ws) {
      const headers = ws.data.headers as Record<string, string | undefined>;
      const key = headers["x-api-key"] ?? headers["X-API-Key"];

      if (!key) {
        logger.warn("[ws] Connection rejected: Missing API key");
        ws.send({ type: "ERROR", message: "Missing API key" });
        ws.close();
        return;
      }

      try {
        const { universeId } = await validateApiKey(key);
        wsManager.add(universeId, ws as unknown as WSLike);

        ws.send(
          serialize({
            type: "CONNECTED",
            universeId,
            timestamp: new Date(),
          }),
        );
      } catch {
        logger.warn("[ws] Connection rejected: Invalid API key");
        ws.send({ type: "ERROR", message: "Invalid API key" });
        ws.close();
      }
    },

    async message(ws, message: any) {
      const universeId = (ws.data as any).universeId;
      if (!universeId) return;

      try {
        const data = typeof message === "string" ? JSON.parse(message) : message;

        switch (data.type) {
          case "PING":
            ws.send({ type: "PONG", timestamp: new Date().toISOString() });
            break;

          case "QUERY_LOGS": {
            const limit = Math.min(Number(data.payload?.limit || 50), 100);
            const logs = await listUniverseLogs(universeId, limit);
            ws.send(serialize({ type: "LOGS_QUERY_RESULT", logs }));
            break;
          }

          case "SEND_LOG": {
            const newLog = await createLog(universeId, data.payload);
            ws.send(serialize({ type: "LOG_CREATED", id: newLog.id }));
            break;
          }

          default:
            ws.send({ type: "ERROR", message: "Unknown command" });
        }
      } catch {
        ws.send({ type: "ERROR", message: "Invalid payload" });
      }
    },

    close(ws) {
      wsManager.remove(ws as unknown as WSLike);
    },
  });
};
