import { logger } from "@/core/logger";
import type { App } from "@/server/server";
import { normalizeLogResponse } from "@/server/utils/log-response";
import { serialize } from "@/server/utils/serialization";
import { type WSLike, wsManager } from "@/server/websocket/manager";
import { validateApiKey } from "@/services/api-keys.service";
import {
  createLog,
  createLogsBulk,
  deleteLogs,
  getLogsCount,
  LOGS_LIST_MAX_LIMIT,
  listLogs,
} from "@/services/logs.service";

function parseOptionalIsoDate(value: unknown): Date | undefined {
  if (value == null || value === "") return undefined;
  const s = typeof value === "string" ? value : String(value);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseQueryLogsPayload(payload: unknown): {
  level?: "info" | "warn" | "error";
  topic?: string;
  from?: Date;
  to?: Date;
  cursor_ts?: Date;
  cursor_id?: string;
  limit?: number;
} | null {
  if (payload == null || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const level = p.level;
  const validLevel = level === "info" || level === "warn" || level === "error" ? level : undefined;
  const topic = typeof p.topic === "string" && p.topic.length <= 100 ? p.topic : undefined;
  const from = parseOptionalIsoDate(p.from);
  const to = parseOptionalIsoDate(p.to);
  const cursor_ts = parseOptionalIsoDate(p.cursor_ts);
  const cursor_id =
    typeof p.cursor_id === "string" && p.cursor_id.length > 0 ? p.cursor_id : undefined;
  let limit: number | undefined;
  if (p.limit != null) {
    const n = Number(p.limit);
    if (!Number.isNaN(n) && n >= 1) limit = Math.min(Math.floor(n), LOGS_LIST_MAX_LIMIT);
  }
  return {
    level: validLevel,
    topic,
    from,
    to,
    cursor_ts,
    cursor_id,
    limit,
  };
}

function parseQueryCountPayload(payload: unknown): {
  from?: Date;
  to?: Date;
} | null {
  if (payload == null || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  return {
    from: parseOptionalIsoDate(p.from),
    to: parseOptionalIsoDate(p.to),
  };
}

function parseDeleteLogsPayload(payload: unknown): {
  olderThan: Date;
  level?: "info" | "warn" | "error";
  topic?: string;
} | null {
  if (payload == null || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const olderThan = parseOptionalIsoDate(p.olderThan);
  if (olderThan == null) return null;
  const level =
    p.level === "info" || p.level === "warn" || p.level === "error" ? p.level : undefined;
  const topic = typeof p.topic === "string" && p.topic.length <= 100 ? p.topic : undefined;
  return { olderThan, level, topic };
}

function parseSendLogPayload(payload: unknown): {
  level: "info" | "warn" | "error";
  message: string;
  metadata?: unknown;
  topic?: string;
} | null {
  if (payload == null || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const level = p.level;
  if (level !== "info" && level !== "warn" && level !== "error") return null;
  const message = p.message;
  if (typeof message !== "string" || message.length > 2048) return null;
  const topic =
    p.topic != null
      ? typeof p.topic === "string" && p.topic.length <= 100
        ? p.topic
        : undefined
      : undefined;
  return {
    level,
    message,
    metadata: p.metadata,
    topic,
  };
}

function parseSendLogsBulkPayload(payload: unknown): {
  logs: Array<{
    level: "info" | "warn" | "error";
    message: string;
    metadata?: unknown;
    topic?: string;
  }>;
} | null {
  if (payload == null || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const arr = p.logs;
  if (!Array.isArray(arr) || arr.length === 0 || arr.length > 100) return null;
  const logs: Array<{
    level: "info" | "warn" | "error";
    message: string;
    metadata?: unknown;
    topic?: string;
  }> = [];
  for (const item of arr) {
    const parsed = parseSendLogPayload(item);
    if (!parsed) return null;
    logs.push(parsed);
  }
  return { logs };
}

export const registerRealtime = (app: App) => {
  app.ws("/realtime", {
    async open(ws) {
      const headers = (ws.data as Record<string, unknown>).headers as
        | Record<string, string | undefined>
        | undefined;
      const key = headers?.["x-api-key"] ?? headers?.["X-API-Key"];

      if (!key) {
        logger.warn("[ws] Connection rejected: Missing API key");
        ws.send(serialize({ type: "ERROR", message: "Missing API key" }));
        ws.close();
        return;
      }

      try {
        const { universeId } = await validateApiKey(key);
        (ws.data as Record<string, unknown>).universeId = universeId;
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
        ws.send(serialize({ type: "ERROR", message: "Invalid API key" }));
        ws.close();
      }
    },

    async message(ws, message: unknown) {
      const universeId = (ws.data as Record<string, unknown>).universeId as bigint | undefined;
      if (universeId == null) {
        ws.send(serialize({ type: "ERROR", message: "Not authenticated" }));
        return;
      }

      let data: { type?: string; payload?: unknown };
      try {
        data =
          typeof message === "string"
            ? (JSON.parse(message) as { type?: string; payload?: unknown })
            : (message as { type?: string; payload?: unknown });
      } catch {
        ws.send(serialize({ type: "ERROR", message: "Invalid payload" }));
        return;
      }

      if (data == null || typeof data !== "object") {
        ws.send(serialize({ type: "ERROR", message: "Invalid payload" }));
        return;
      }

      try {
        switch (data.type) {
          case "PING":
            ws.send(serialize({ type: "PONG", timestamp: new Date().toISOString() }));
            break;

          case "QUERY_LOGS": {
            const filters = parseQueryLogsPayload(data.payload);
            if (filters === null) {
              ws.send(serialize({ type: "ERROR", message: "Invalid payload" }));
              return;
            }
            const limit = Math.min(Math.max(1, filters.limit ?? 20), LOGS_LIST_MAX_LIMIT);
            const rows = await listLogs(universeId, {
              level: filters.level,
              topic: filters.topic,
              from: filters.from,
              to: filters.to,
              cursorTimestamp: filters.cursor_ts,
              cursorId: filters.cursor_id,
              limit,
            });
            const logsOut = rows.map((log) =>
              normalizeLogResponse(serialize(log) as Record<string, unknown>),
            );
            const nextCursor =
              rows.length === limit && rows.length > 0
                ? {
                    timestamp: (rows[rows.length - 1]!.timestamp as Date).toISOString(),
                    id: rows[rows.length - 1]!.id,
                  }
                : undefined;
            ws.send(
              serialize({
                type: "LOGS_QUERY_RESULT",
                logs: logsOut,
                nextCursor,
              }),
            );
            break;
          }

          case "QUERY_LOGS_COUNT": {
            const filters = parseQueryCountPayload(data.payload);
            if (filters === null) {
              ws.send(serialize({ type: "ERROR", message: "Invalid payload" }));
              return;
            }
            const result = await getLogsCount(universeId, {
              from: filters.from,
              to: filters.to,
            });
            ws.send(
              serialize({
                type: "LOGS_COUNT_RESULT",
                total: result.total,
                byLevel: result.byLevel,
              }),
            );
            break;
          }

          case "DELETE_LOGS": {
            const filters = parseDeleteLogsPayload(data.payload);
            if (filters === null) {
              ws.send(serialize({ type: "ERROR", message: "Invalid payload" }));
              return;
            }
            const deleted = await deleteLogs(universeId, filters);
            ws.send(serialize({ type: "LOGS_DELETED", deleted }));
            break;
          }

          case "SEND_LOGS_BULK": {
            const parsed = parseSendLogsBulkPayload(data.payload);
            if (parsed === null) {
              ws.send(serialize({ type: "ERROR", message: "Invalid payload" }));
              return;
            }
            const inserted = await createLogsBulk(universeId, parsed.logs);
            ws.send(serialize({ type: "LOGS_BULK_CREATED", count: inserted.length }));
            break;
          }

          case "SEND_LOG": {
            const payload = parseSendLogPayload(data.payload);
            if (payload === null) {
              ws.send(serialize({ type: "ERROR", message: "Invalid payload" }));
              return;
            }
            const newLog = await createLog(universeId, payload);
            ws.send(
              serialize({
                type: "LOG_CREATED",
                id: newLog.id,
              }),
            );
            break;
          }

          default:
            ws.send(serialize({ type: "ERROR", message: "Unknown command" }));
        }
      } catch (err) {
        logger.error("[ws] Command error", { error: err });
        ws.send(serialize({ type: "ERROR", message: "Invalid payload" }));
      }
    },

    close(ws) {
      wsManager.remove(ws as unknown as WSLike);
    },
  });
};
