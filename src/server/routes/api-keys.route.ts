import { countActiveApiKeys, createApiKey, getIdByKey, listApiKeys, revokeKey, validateApiKey } from "@/services/api-keys.service";
import { t } from "elysia";
import { AuthError, ValidationError } from "../errors";
import type { RouteApp } from "../server";
import { serialize } from "../utils/serialization";

export default function registerApiKeyRoutes(app: RouteApp) {
  const parseUniverseId = (value: unknown): bigint | null => {
    if (typeof value === "bigint") return value;
    if (typeof value === "number") {
      if (!Number.isFinite(value) || !Number.isInteger(value)) return null;
      return BigInt(value);
    }
    if (typeof value === "string") {
      if (!value.trim()) return null;
      try {
        return BigInt(value);
      } catch {
        return null;
      }
    }
    return null;
  };

  app.post<{ universeId: number | string }>("/keys/register", async (ctx) => {
    const { universeId } = ctx.body;
    const parsedUniverseId = parseUniverseId(universeId);

    if (parsedUniverseId === null) {
      throw new ValidationError("universeId é obrigatório e deve ser um número inteiro ou string numérica");
    }

    const { key } = await createApiKey(parsedUniverseId);
    return { key };
  }, {
    body: t.Object({
      universeId: t.Union([t.Number(), t.String()])
    }),
    detail: {
      tags: ["Internal", "API Keys"],
      summary: "Registrar Nova Key",
      security: [{ MasterKeyAuth: [] }],
    }
  });

  app.post<{ key: string }>("/keys/revoke", async (ctx) => {
    const { key } = ctx.body;

    const id = await getIdByKey(key);
    if (!id) {
      throw new AuthError("Chave de API inválida");
    }

    await revokeKey(id);
    return { success: true };
  }, {
    body: t.Object({
      key: t.String()
    }),
    detail: {
      tags: ["Internal", "API Keys"],
      summary: "Revogar Key",
      security: [{ MasterKeyAuth: [] }],
    }
  });

  app.get("/keys/validate", async (ctx) => {
    const key = ctx.query.key;

    if (!key) {
      throw new ValidationError("Chave de API ausente");
    }

    const { universeId } = await validateApiKey(key);
    return serialize({ valid: true, universeId });
  }, {
    query: t.Object({
      key: t.String()
    }),
    detail: {
      tags: ["Internal", "API Keys"],
      summary: "Validar Key",
      security: [{ MasterKeyAuth: [] }],
    }
  });

  app.get("/keys/list", async (ctx) => {
    const { universeId } = ctx.query;
    const parsedUniverseId = universeId ? parseUniverseId(universeId) : undefined;

    if (parsedUniverseId === null) {
      throw new ValidationError("universeId deve ser um número inteiro ou string numérica");
    }

    const keys = await listApiKeys(parsedUniverseId);
    return serialize(keys);
  }, {
    query: t.Object({
      universeId: t.Optional(t.Union([t.Number(), t.String()]))
    }),
    detail: {
      tags: ["Internal", "API Keys"],
      summary: "Listar Keys",
      security: [{ MasterKeyAuth: [] }],
    }
  });

  app.get("/keys/count", async (ctx) => {
    const count = await countActiveApiKeys();
    return { count };
  }, {
    detail: {
      tags: ["Internal", "API Keys"],
      summary: "Contar Keys Ativas",
      security: [{ MasterKeyAuth: [] }],
    }
  });

  return "internal";
}