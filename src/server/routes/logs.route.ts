import { t } from "elysia";
import {
  createLog,
  createLogsBulk,
  deleteLogs,
  getLogById,
  getLogsCount,
  LOGS_LIST_DEFAULT_LIMIT,
  LOGS_LIST_MAX_LIMIT,
  listLogs,
} from "@/services/logs.service";
import { NotFoundError, ValidationError } from "../errors";
import { rateLimitHandler } from "../handlers/rate-limit";
import type { RouteApp } from "../server";
import { normalizeLogResponse } from "../utils/log-response";
import { serialize } from "../utils/serialization";

const levelSchema = t.Union([t.Literal("info"), t.Literal("warn"), t.Literal("error")]);
const logItemBody = t.Object({
  level: levelSchema,
  message: t.String({ maxLength: 2048 }),
  metadata: t.Optional(t.Any()),
  topic: t.Optional(t.String({ maxLength: 100 })),
});

type LogBody = {
  level: "info" | "warn" | "error";
  message: string;
  metadata?: unknown;
  topic?: string;
};

const LogResponse = t.Object({
  id: t.String(),
  universe_id: t.String(),
  level: t.Union([t.Literal("info"), t.Literal("warn"), t.Literal("error")]),
  message: t.String(),
  metadata: t.Any(),
  topic: t.Nullable(t.String()),
  timestamp: t.String(),
});

const ListLogsResponse = t.Object({
  logs: t.Array(LogResponse),
  nextCursor: t.Optional(
    t.Object({
      timestamp: t.String(),
      id: t.String(),
    }),
  ),
});

const CountResponse = t.Object({
  total: t.Number(),
  byLevel: t.Object({
    info: t.Number(),
    warn: t.Number(),
    error: t.Number(),
  }),
});

const DeleteLogsResponse = t.Object({
  deleted: t.Number(),
});

function parseOptionalIsoDate(value: string | undefined): Date | undefined {
  if (value == null || value === "") return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export default function registerLogsRoutes(app: RouteApp) {
  // GET /logs/count — antes de /logs/:id para não capturar "count" como id
  app.get(
    "/logs/count",
    async (ctx) => {
      const universeId = ctx.universeId;
      const q = ctx.query;
      const from = parseOptionalIsoDate(q.from);
      const to = parseOptionalIsoDate(q.to);
      const result = await getLogsCount(universeId, { from, to });
      return result;
    },
    {
      query: t.Object({
        from: t.Optional(t.String()),
        to: t.Optional(t.String()),
      }),
      response: CountResponse,
      authRequired: true,
      beforeHandle: rateLimitHandler({ maxRequests: 120, windowMs: 60_000 }),
      detail: {
        tags: ["Logs"],
        summary: "Contagem de logs",
        description: "Retorna total e contagem por level, com filtro opcional de data.",
        security: [{ ApiKeyAuth: [] }],
      },
    },
  );

  // GET /logs — listagem com filtros e cursor
  app.get(
    "/logs",
    async (ctx) => {
      const universeId = ctx.universeId;
      const q = ctx.query;
      const from = parseOptionalIsoDate(q.from);
      const to = parseOptionalIsoDate(q.to);
      const cursorTs = parseOptionalIsoDate(q.cursor_ts);
      const limitRaw = q.limit != null ? Number(q.limit) : undefined;
      const limit =
        limitRaw != null && !Number.isNaN(limitRaw)
          ? Math.min(LOGS_LIST_MAX_LIMIT, Math.max(1, Math.floor(limitRaw)))
          : LOGS_LIST_DEFAULT_LIMIT;

      const level =
        q.level === "info" || q.level === "warn" || q.level === "error" ? q.level : undefined;

      const rows = await listLogs(universeId, {
        level,
        topic: q.topic ?? undefined,
        from,
        to,
        cursorTimestamp: cursorTs,
        cursorId: q.cursor_id ?? undefined,
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

      return { logs: logsOut, nextCursor };
    },
    {
      query: t.Object({
        level: t.Optional(levelSchema),
        topic: t.Optional(t.String({ maxLength: 100 })),
        from: t.Optional(t.String()),
        to: t.Optional(t.String()),
        cursor_ts: t.Optional(t.String()),
        cursor_id: t.Optional(t.String()),
        limit: t.Optional(t.String()), // Elysia query é sempre string
      }),
      response: ListLogsResponse,
      authRequired: true,
      beforeHandle: rateLimitHandler({ maxRequests: 120, windowMs: 60_000 }),
      detail: {
        tags: ["Logs"],
        summary: "Listar logs",
        description:
          "Lista logs com filtros (level, topic, from, to), paginação cursor-based e limite máximo 100.",
        security: [{ ApiKeyAuth: [] }],
      },
    },
  );

  // POST /logs/bulk — antes de POST /logs
  app.post(
    "/logs/bulk",
    async (ctx) => {
      const universeId = ctx.universeId;
      const body = ctx.body as {
        logs: Array<{
          level: "info" | "warn" | "error";
          message: string;
          metadata?: unknown;
          topic?: string;
        }>;
      };
      const items = body.logs;
      if (items.length === 0) {
        throw new ValidationError("Array de logs não pode ser vazio.");
      }
      const inserted = await createLogsBulk(universeId, items);
      return {
        logs: inserted.map((log) =>
          normalizeLogResponse(serialize(log) as Record<string, unknown>),
        ),
      };
    },
    {
      body: t.Object({
        logs: t.Array(logItemBody, { minItems: 1, maxItems: 100 }),
      }),
      response: t.Object({ logs: t.Array(LogResponse) }),
      authRequired: true,
      beforeHandle: rateLimitHandler({ maxRequests: 20, windowMs: 60_000 }),
      detail: {
        tags: ["Logs"],
        summary: "Criar logs em lote",
        description:
          "Insere múltiplos logs em uma transação. Retorna os registros inseridos. Máximo 100 itens por requisição.",
        security: [{ ApiKeyAuth: [] }],
      },
    },
  );

  app.post<LogBody>(
    "/logs",
    async (ctx) => {
      const universeId = ctx.universeId;
      const { level, message, metadata, topic } = ctx.body;

      const log = await createLog(universeId, {
        level,
        message,
        metadata,
        topic,
      });

      return normalizeLogResponse(serialize(log) as Record<string, unknown>);
    },
    {
      body: t.Object({
        level: t.Union([t.Literal("info"), t.Literal("warn"), t.Literal("error")]),
        message: t.String({ maxLength: 2048 }),
        metadata: t.Optional(t.Any()),
        topic: t.Optional(t.String({ maxLength: 100 })),
      }),
      response: LogResponse,
      authRequired: true,
      beforeHandle: rateLimitHandler({ maxRequests: 100, windowMs: 60_000 }),
      detail: {
        tags: ["Logs"],
        summary: "Criar Log",
        description: "Registra um novo evento de log associado ao universo autenticado.",
        security: [{ ApiKeyAuth: [] }],
        responses: {
          200: { description: "Log criado com sucesso" },
          401: { description: "API Key inválida ou ausente" },
          429: { description: "Rate limit excedido" },
        },
      },
    },
  );

  app.get(
    "/logs/:id",
    async (ctx) => {
      const universeId = ctx.universeId;
      const { id } = ctx.params;

      const log = await getLogById(id, universeId);
      if (!log) {
        throw new NotFoundError("Log não encontrado");
      }

      return normalizeLogResponse(serialize(log) as Record<string, unknown>);
    },
    {
      response: LogResponse,
      authRequired: true,
      beforeHandle: rateLimitHandler({ maxRequests: 60, windowMs: 60_000 }),
      detail: {
        tags: ["Logs"],
        summary: "Buscar Log por ID",
        security: [{ ApiKeyAuth: [] }],
        responses: {
          200: { description: "Detalhes do log" },
          404: { description: "Log não encontrado ou não pertence ao universo" },
        },
      },
    },
  );

  // DELETE /logs — por olderThan, level e topic opcionais
  app.delete(
    "/logs",
    async (ctx) => {
      const q = ctx.query;
      const olderThan = parseOptionalIsoDate(q.olderThan);
      if (olderThan == null) {
        throw new ValidationError("Query 'olderThan' (ISO date) é obrigatória.");
      }
      const level =
        q.level === "info" || q.level === "warn" || q.level === "error" ? q.level : undefined;
      const deleted = await deleteLogs(BigInt(ctx.universeId as string | number | bigint), {
        olderThan,
        level,
        topic: q.topic ?? undefined,
      });
      return { deleted };
    },
    {
      query: t.Object({
        olderThan: t.String({ description: "Data ISO; logs mais antigos serão removidos" }),
        level: t.Optional(levelSchema),
        topic: t.Optional(t.String({ maxLength: 100 })),
      }),
      response: DeleteLogsResponse,
      authRequired: true,
      beforeHandle: rateLimitHandler({ maxRequests: 30, windowMs: 60_000 }),
      detail: {
        tags: ["Logs"],
        summary: "Remover logs",
        description:
          "Remove logs do universo mais antigos que olderThan, com filtros opcionais por level e topic.",
        security: [{ ApiKeyAuth: [] }],
      },
    },
  );

  return "api";
}
