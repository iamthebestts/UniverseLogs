import { createApiKey } from "@/services/api-keys.service";
import { createUniverse, getUniverse, listUniverseLogs, revokeUniverse } from "@/services/universes.service";
import { t } from "elysia";
import type { RouteApp } from "../server";
import { ValidationError } from "../errors";
import { serialize } from "../utils/serialization";
import { rateLimitHandler } from "../handlers/rate-limit";

const parseUniverseId = (value: unknown): bigint | null => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value) || !Number.isSafeInteger(value))
      return null;
    return BigInt(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return BigInt(trimmed);
    } catch {
      return null;
    }
  }
  return null;
};

export default function registerUniverseRoutes(app: RouteApp) {
  app.post<{ universeId: number | string; name?: string; description?: string; createKey?: boolean }>(
    "/universes",
    async (ctx) => {
      const { universeId, name, description, createKey } = ctx.body;
      const parsed = parseUniverseId(universeId);
      if (parsed === null) {
        throw new ValidationError(
          "universeId é obrigatório e deve ser um inteiro ou string numérica"
        );
      }

      const manual = name ? { name, description, extra: {} } : undefined;
      const universe = await createUniverse(parsed, manual);

      let key: string | undefined;
      if (createKey !== false) {
        const created = await createApiKey(parsed);
        key = created.key;
      }

      return serialize({ universe, key });
    },
    {
      body: t.Object({
        universeId: t.Union([t.Number(), t.String()]),
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
        createKey: t.Optional(t.Boolean()),
      }),
      authRequired: true,
      beforeHandle: rateLimitHandler({ maxRequests: 10, windowMs: 60_000 }),
      detail: {
        tags: ["Universes"],
        summary: "Criar/Registrar Universo (Público)",
        description: "Permite registrar um universo manualmente se a chave for válida.",
        security: [{ ApiKeyAuth: [] }], // Nota: esta rota usa auth, mas tipicamente criação pública poderia ser aberta ou restrita. Assumindo comportamento atual.
      },
    }
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
      authRequired: true, 
      beforeHandle: rateLimitHandler({ maxRequests: 10, windowMs: 60_000 }),
      detail: {
        tags: ["Universes"],
        summary: "Revogar Universo",
        description: "Desativa um universo e invalida suas chaves.",
        security: [{ ApiKeyAuth: [] }],
      },
    }
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
      return serialize({ universe, logs });
    },
    { 
      authRequired: true, 
      beforeHandle: rateLimitHandler({ maxRequests: 60, windowMs: 60_000 }),
      detail: {
        tags: ["Universes"],
        summary: "Consultar Universo",
        description: "Retorna metadados do universo e os últimos 10 logs.",
        security: [{ ApiKeyAuth: [] }],
      },
    }
  );

  return "api";
}
