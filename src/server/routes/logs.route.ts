import { createLog, getLogById } from "@/services/logs.service";
import { t } from "elysia";
import { NotFoundError } from "../errors";
import type { RouteApp } from "../server";
import { serialize } from "../utils/serialization";

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
    }
  );

  return "api";
}

