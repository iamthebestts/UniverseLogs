import { t } from "elysia";
import { createLog, getLogById } from "@/services/logs.service";
import { NotFoundError } from "../errors";
import { rateLimitHandler } from "../handlers/rate-limit";
import type { RouteApp } from "../server";
import { serialize } from "../utils/serialization";

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

function normalizeLogResponse(log: Record<string, unknown>) {
  return {
    ...log,
    topic: log.topic ?? null,
    metadata: log.metadata ?? {},
    timestamp:
      log.timestamp != null ? log.timestamp : new Date().toISOString(),
  };
}

export default function registerLogsRoutes(app: RouteApp) {
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

  return "api";
}
