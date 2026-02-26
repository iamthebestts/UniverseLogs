import { t } from "elysia";
import { createApiKey } from "@/services/api-keys.service";
import {
  createUniverse,
  getUniverse,
  listUniverseLogs,
  revokeUniverse,
} from "@/services/universes.service";
import { ValidationError } from "../errors";
import { rateLimitHandler } from "../handlers/rate-limit";
import type { RouteApp } from "../server";
import { parseUniverseId } from "../utils/parsing";
import { serialize } from "../utils/serialization";

const UniverseResponse = t.Object({
  universe_id: t.String(),
  name: t.String(),
  description: t.Nullable(t.String()),
  metadata: t.Any(),
  is_active: t.Boolean(),
  created_at: t.String(),
  updated_at: t.Nullable(t.String()),
});

const LogResponse = t.Object({
  id: t.String(),
  universe_id: t.String(),
  level: t.Union([t.Literal("info"), t.Literal("warn"), t.Literal("error")]),
  message: t.String(),
  metadata: t.Any(),
  topic: t.Nullable(t.String()),
  timestamp: t.String(),
});

function normalizeUniverse(u: Record<string, unknown>) {
  return { ...u, description: u.description ?? null };
}

function normalizeLogForResponse(log: Record<string, unknown>) {
  return {
    ...log,
    topic: log.topic ?? null,
    metadata: log.metadata ?? {},
    timestamp: log.timestamp != null ? log.timestamp : new Date().toISOString(),
  };
}

export default function registerUniverseRoutes(app: RouteApp) {
  app.post<{
    universeId: number | string;
    name?: string;
    description?: string;
    createKey?: boolean;
  }>(
    "/universes",
    async (ctx) => {
      const { universeId, name, description, createKey } = ctx.body;
      const parsed = parseUniverseId(universeId);
      if (parsed === null) {
        throw new ValidationError(
          "universeId é obrigatório e deve ser um inteiro ou string numérica",
        );
      }

      const manual = name
        ? {
            name,
            ...(description !== undefined ? { description } : {}),
            extra: {},
          }
        : undefined;
      const universe = await createUniverse(parsed, manual);

      let key: string | undefined;
      if (createKey !== false) {
        const created = await createApiKey(parsed);
        key = created.key;
      }

      const out = serialize({ universe, key }) as {
        universe: Record<string, unknown>;
        key?: string;
      };
      if (out.universe) out.universe = normalizeUniverse(out.universe);
      return out;
    },
    {
      body: t.Object({
        universeId: t.Union([t.Number(), t.String()]),
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
        createKey: t.Optional(t.Boolean()),
      }),
      response: t.Object({
        universe: UniverseResponse,
        key: t.Optional(t.String()),
      }),
      authRequired: true,
      beforeHandle: rateLimitHandler({ maxRequests: 10, windowMs: 60_000 }),
      detail: {
        tags: ["Universes"],
        summary: "Criar/Registrar Universo (Público)",
        description: "Permite registrar um universo manualmente se a chave for válida.",
        security: [{ ApiKeyAuth: [] }],
      },
    },
  );

  app.post(
    "/universes/:id/revoke",
    async (ctx) => {
      const parsed = parseUniverseId(ctx.params.id);
      if (parsed === null) {
        throw new ValidationError("id inválido");
      }
      await revokeUniverse(parsed);
      return { success: true };
    },
    {
      response: t.Object({
        success: t.Boolean(),
      }),
      authRequired: true,
      beforeHandle: rateLimitHandler({ maxRequests: 10, windowMs: 60_000 }),
      detail: {
        tags: ["Universes"],
        summary: "Revogar Universo",
        description: "Desativa um universo e invalida suas chaves.",
        security: [{ ApiKeyAuth: [] }],
      },
    },
  );

  app.get(
    "/universes/:id",
    async (ctx) => {
      const parsed = parseUniverseId(ctx.params.id);
      if (parsed === null) {
        throw new ValidationError("id inválido");
      }
      const universe = await getUniverse(parsed);
      if (!universe) return serialize(null);
      const logs = await listUniverseLogs(parsed, 10);
      const out = serialize({ universe, logs }) as {
        universe: Record<string, unknown>;
        logs: Record<string, unknown>[];
      };
      if (out.universe) out.universe = normalizeUniverse(out.universe);
      if (Array.isArray(out.logs)) out.logs = out.logs.map(normalizeLogForResponse);
      return out;
    },
    {
      response: t.Nullable(
        t.Object({
          universe: UniverseResponse,
          logs: t.Array(LogResponse),
        }),
      ),
      authRequired: true,
      beforeHandle: rateLimitHandler({ maxRequests: 60, windowMs: 60_000 }),
      detail: {
        tags: ["Universes"],
        summary: "Consultar Universo",
        description: "Retorna metadados do universo e os últimos 10 logs.",
        security: [{ ApiKeyAuth: [] }],
      },
    },
  );

  return "api";
}
