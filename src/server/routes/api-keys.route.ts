import { countActiveApiKeys, createApiKey, getIdByKey, listApiKeys, revokeKey, validateApiKey } from "@/services/api-keys.service";
import type Elysia from "elysia";
import { t } from "elysia";

export default function registerApiKeyRoutes(app: Elysia) {
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

  app.post("/keys/register", async (ctx) => {
    const { universeId } = ctx.body;
    const parsedUniverseId = parseUniverseId(universeId);

    if (parsedUniverseId === null) {
      ctx.set.status = 400;
      return { error: "universeId é obrigatório e deve ser um número inteiro ou string numérica" };
    }

    try {
      const { key } = await createApiKey(parsedUniverseId);
      return { key };
    } catch (err) {
      ctx.set.status = 500;
      return { error: "Erro ao criar a chave de API" };
    }
  }, {
    body: t.Object({
      universeId: t.Union([t.Number(), t.String()])
    }),
    response: {
      200: t.Object({
        key: t.String()
      }),
      400: t.Object({
        error: t.String()
      }),
      500: t.Object({
        error: t.String()
      })
    }
  });

  app.post("/keys/revoke", async (ctx) => {
    const { key } = ctx.body;

    const id = await getIdByKey(key);
    if (!id) {
      ctx.set.status = 400;
      return { error: "Chave de API inválida" };
    }

    try {
      await revokeKey(id);
      return { success: true };
    } catch (err) {
      ctx.set.status = 500;
      return { error: "Erro ao revogar a chave de API" };
    }
  }, {
    body: t.Object({
      key: t.String()
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
      }),
      400: t.Object({
        error: t.String()
      }),
      500: t.Object({
        error: t.String()
      })
    }
  });

  app.get("/keys/validate", async (ctx) => {
    const { key } = ctx.query;

    try {
      const { universeId } = await validateApiKey(key);
      return { valid: true, universeId: universeId.toString() };
    } catch (err) {
      ctx.set.status = 400;
      return { valid: false };
    }
  }, {
    query: t.Object({
      key: t.String()
    }),
    response: {
      200: t.Object({
        valid: t.Boolean(),
        universeId: t.Optional(t.String())
      }),
      400: t.Object({
        valid: t.Boolean(),
        universeId: t.Optional(t.String())
      }),
      500: t.Object({
        valid: t.Boolean()
      })
    }
  });

  app.get("/keys/list", async (ctx) => {
    const { universeId } = ctx.query;
    const parsedUniverseId = universeId ? parseUniverseId(universeId) : undefined;

    if (parsedUniverseId === null) {
      ctx.set.status = 400;
      return { error: "universeId deve ser um número inteiro ou string numérica" };
    }

    try {
      const keys = await listApiKeys(parsedUniverseId);
      // Serialize dates to ISO strings
      const serializedKeys = keys.map(key => ({
        ...key,
        created_at: key.created_at?.toISOString(),
        last_used_at: key.last_used_at?.toISOString(),
        revoked_at: key.revoked_at?.toISOString()
      }));
      return serializedKeys;
    } catch (err) {
      ctx.set.status = 500;
      return { error: "Erro ao listar chaves de API" };
    }
  }, {
    query: t.Object({
      universeId: t.Optional(t.Union([t.Number(), t.String()]))
    }),
    response: {
      200: t.Array(
        t.Object({
          id: t.String(),
          is_active: t.Boolean(),
          created_at: t.Optional(t.String()),
          last_used_at: t.Optional(t.String()),
          revoked_at: t.Optional(t.String())
        })
      ),
      400: t.Object({
        error: t.String()
      }),
      500: t.Object({
        error: t.String()
      })
    }
  });

  app.get("/keys/count", async (ctx) => {
    try {
      const count = await countActiveApiKeys();
      return { count };
    } catch (err) {
      ctx.set.status = 500;
      return { error: "Erro ao contar chaves de API" };
    }
  }, {
    response: {
      200: t.Object({
        count: t.Number()
      }),
      500: t.Object({
        error: t.String()
      })
    }
  });

  return "internal";
}