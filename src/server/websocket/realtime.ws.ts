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

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const deleteRateLimits = new Map<bigint, number>();
const DELETE_COOLDOWN_MS = 2000;

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

  const cursor_ts = parseOptionalIsoDate(p.cursor_ts ?? p.timestamp);
  const rawCursorId = p.cursor_id ?? p.id;

  const cursor_id =
    typeof rawCursorId === "string" && rawCursorId.length > 0 ? rawCursorId : undefined;

  let limit: number | undefined;
  if (p.limit != null) {
    const n = Number(p.limit);
    if (!Number.isNaN(n) && n >= 1) limit = Math.min(Math.floor(n), LOGS_LIST_MAX_LIMIT);
  }
  const out: {
    level?: "info" | "warn" | "error";
    topic?: string;
    from?: Date;
    to?: Date;
    cursor_ts?: Date;
    cursor_id?: string;
    limit?: number;
  } = {};
  if (validLevel !== undefined) out.level = validLevel;
  if (topic !== undefined) out.topic = topic;
  if (from !== undefined) out.from = from;
  if (to !== undefined) out.to = to;
  if (cursor_ts !== undefined) out.cursor_ts = cursor_ts;
  if (cursor_id !== undefined) out.cursor_id = cursor_id;
  if (limit !== undefined) out.limit = limit;
  return out;
}

function parseQueryCountPayload(payload: unknown): {
  from?: Date;
  to?: Date;
} | null {
  if (payload == null || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const from = parseOptionalIsoDate(p.from);
  const to = parseOptionalIsoDate(p.to);
  const out: { from?: Date; to?: Date } = {};
  if (from !== undefined) out.from = from;
  if (to !== undefined) out.to = to;
  return out;
}

function parseDeleteLogsPayload(payload: unknown): {
  olderThan: Date;
  confirm: boolean;
  level?: "info" | "warn" | "error";
  topic?: string;
} | null {
  if (payload == null || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const olderThan = parseOptionalIsoDate(p.olderThan);
  if (olderThan == null) return null;
  const confirm = p.confirm === true;
  const level =
    p.level === "info" || p.level === "warn" || p.level === "error" ? p.level : undefined;
  const topic = typeof p.topic === "string" && p.topic.length <= 100 ? p.topic : undefined;
  const out: {
    olderThan: Date;
    confirm: boolean;
    level?: "info" | "warn" | "error";
    topic?: string;
  } = { olderThan, confirm };
  if (level !== undefined) out.level = level;
  if (topic !== undefined) out.topic = topic;
  return out;
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
  const out: {
    level: "info" | "warn" | "error";
    message: string;
    metadata?: unknown;
    topic?: string;
  } = { level, message };
  if (p.metadata !== undefined) out.metadata = p.metadata;
  if (topic !== undefined) out.topic = topic;
  return out;
}

function parseSendLogsBulkPayload(payload: unknown): {
  logs?: Array<{
    level: "info" | "warn" | "error";
    message: string;
    metadata?: unknown;
    topic?: string;
  }>;
  errors?: Array<{ index: number; reason: string }>;
} | null {
  if (payload == null || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const arr = p.logs;
  if (!Array.isArray(arr) || arr.length === 0 || arr.length > 100) return null;

  const logs: Array<any> = [];
  const errors: Array<{ index: number; reason: string }> = [];

  arr.forEach((item, index) => {
    const parsed = parseSendLogPayload(item);
    if (!parsed) {
      errors.push({ index, reason: "Invalid item structure or missing required fields" });
    } else {
      logs.push(parsed);
    }
  });

  if (errors.length > 0) return { errors };
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
              throw new ValidationError("Invalid payload");
            }
            const limit = Math.min(Math.max(1, filters.limit ?? 20), LOGS_LIST_MAX_LIMIT);
            const listFilters: {
              level?: "info" | "warn" | "error";
              topic?: string;
              from?: Date;
              to?: Date;
              cursorTimestamp?: Date;
              cursorId?: string;
              limit: number;
            } = { limit };
            if (filters.level !== undefined) listFilters.level = filters.level;
            if (filters.topic !== undefined) listFilters.topic = filters.topic;
            if (filters.from !== undefined) listFilters.from = filters.from;
            if (filters.to !== undefined) listFilters.to = filters.to;
            if (filters.cursor_ts !== undefined) listFilters.cursorTimestamp = filters.cursor_ts;
            if (filters.cursor_id !== undefined) listFilters.cursorId = filters.cursor_id;

            const rows = await listLogs(universeId, listFilters);
            const logsOut = rows.map((log) =>
              normalizeLogResponse(serialize(log) as Record<string, unknown>),
            );
            const nextCursor =
              rows.length === limit && rows.length > 0
                ? {
                    cursor_ts: (rows[rows.length - 1]!.timestamp as Date).toISOString(),
                    cursor_id: rows[rows.length - 1]!.id,
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
              throw new ValidationError("Invalid payload");
            }
            const countFilters: { from?: Date; to?: Date } = {};
            if (filters.from !== undefined) countFilters.from = filters.from;
            if (filters.to !== undefined) countFilters.to = filters.to;
            const result = await getLogsCount(universeId, countFilters);
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
              throw new ValidationError("Invalid payload");
            }

            if (!filters.confirm) {
              ws.send(
                serialize({
                  type: "ERROR",
                  message: "Campo 'confirm' obrigatório para confirmar deleção",
                }),
              );
              return;
            }

            // Simple Rate Limiting
            const lastDelete = deleteRateLimits.get(universeId) || 0;
            const now = Date.now();
            if (now - lastDelete < DELETE_COOLDOWN_MS) {
              ws.send(serialize({ type: "ERROR", message: "Rate limit exceeded for DELETE_LOGS" }));
              return;
            }
            deleteRateLimits.set(universeId, now);
            setTimeout(() => deleteRateLimits.delete(universeId), DELETE_COOLDOWN_MS);

            // Elevated permissions check (Placeholder: for now, any valid API key is allowed)
            // But we add audit logging
            const deleteFilters: {
              olderThan: Date;
              level?: "info" | "warn" | "error";
              topic?: string;
            } = { olderThan: filters.olderThan };
            if (filters.level !== undefined) deleteFilters.level = filters.level;
            if (filters.topic !== undefined) deleteFilters.topic = filters.topic;
            const deleted = await deleteLogs(universeId, deleteFilters);

            logger.info("[ws] Logs deleted", {
              universeId,
              deleted,
              filters: { olderThan: filters.olderThan, level: filters.level, topic: filters.topic },
              timestamp: new Date(),
            });

            ws.send(serialize({ type: "LOGS_DELETED", deleted }));
            break;
          }

          case "SEND_LOGS_BULK": {
            const parsed = parseSendLogsBulkPayload(data.payload);
            if (parsed === null) {
              throw new ValidationError("Invalid payload");
            }
            if (parsed.errors) {
              ws.send(
                serialize({ type: "ERROR", message: "Validation failed", errors: parsed.errors }),
              );
              return;
            }
            const inserted = await createLogsBulk(universeId, parsed.logs!);
            ws.send(serialize({ type: "LOGS_BULK_CREATED", count: inserted.length }));
            break;
          }

          case "SEND_LOG": {
            const payload = parseSendLogPayload(data.payload);
            if (payload === null) {
              throw new ValidationError("Invalid payload");
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
        const isValidationError =
          err instanceof ValidationError || (err instanceof Error && err.name === "SyntaxError");
        ws.send(
          serialize({
            type: "ERROR",
            message: isValidationError ? "Invalid payload" : "Internal server error",
          }),
        );
      }
    },

    close(ws) {
      wsManager.remove(ws as unknown as WSLike);
    },
  });
};
