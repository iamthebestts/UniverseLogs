import { createLog, getLogById } from "@/services/logs.service";
import { t } from "elysia";
import { NotFoundError } from "../errors";
import type { RouteApp } from "../server";
import { serialize } from "../utils/serialization";
import { rateLimitHandler } from "../handlers/rate-limit";

type LogBody = {
  level: "info" | "warn" | "error";
  message: string;
  metadata?: unknown;
  topic?: string;
};

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

      return serialize(log);
    },
    {
      body: t.Object({
        level: t.Union([
          t.Literal("info"),
          t.Literal("warn"),
          t.Literal("error"),
        ]),
        message: t.String({ maxLength: 2048 }),
        metadata: t.Optional(t.Any()),
        topic: t.Optional(t.String({ maxLength: 100 })),
      }),
      authRequired: true,
      beforeHandle: rateLimitHandler({ maxRequests: 100, windowMs: 60_000 }),
      detail: {
        tags: ["Logs"],
        summary: "Criar Log",
        description: "Registra um novo evento de log associado ao universo autenticado.",
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          description: "Dados do log",
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  level: { type: "string", enum: ["info", "warn", "error"], example: "info" },
                  message: { type: "string", example: "Player joined match" },
                  topic: { type: "string", example: "Matchmaking" },
                  metadata: { type: "object", example: { matchId: 1234 } },
                },
                required: ["level", "message"],
              },
            },
          },
        },
        responses: {
          200: { description: "Log criado com sucesso" },
          401: { description: "API Key inválida ou ausente" },
          429: { description: "Rate limit excedido" },
        },
      },
    }
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

      return serialize(log);
    },
    {
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
    }
  );

  return "api";
}

