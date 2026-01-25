import { countActiveApiKeys, createApiKey, getIdByKey, listApiKeys, revokeKey, validateApiKey } from "@/services/api-keys.service";
import type Elysia from "elysia";
import { t } from "elysia";

export default function registerApiKeyRoutes(app: Elysia) {
  app.post("/keys/register", async (ctx) => {
    const { universeId } = ctx.body;

    if (typeof universeId !== "number") {
      ctx.set.status(400);
      return { error: "universeId é obrigatório e deve ser um número" };
    }

    try {
      const { key } = await createApiKey(universeId);
      return { key };
    } catch (err) {
      ctx.set.status(500);
      return { error: "Erro ao criar a chave de API" };
    }
  }, {
    body: t.Object({
      universeId: t.Number()
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
      ctx.set.status(400);
      return { error: "Chave de API inválida" };
    }

    try {
      await revokeKey(id);
      return { success: true };
    } catch (err) {
      ctx.set.status(500);
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
      const universeId = await validateApiKey(key);
      const isValid = universeId !== null;
      if (!isValid) {
        ctx.set.status(400);
      }
      return { valid: isValid, universeId };
    } catch (err) {
      ctx.set.status(500);
      return { valid: false };
    }
  }, {
    query: t.Object({
      key: t.String()
    }),
    response: {
      200: t.Object({
        valid: t.Boolean(),
        universeId: t.Number().Optional()
      }),
      400: t.Object({
        valid: t.Boolean(),
        universeId: t.Number().Optional()
      }),
      500: t.Object({
        valid: t.Boolean()
      })
    }
  });

  app.get("/keys/list", async (ctx) => {
    const { universeId } = ctx.query;
    const parsedUniverseId = universeId ? Number(universeId) : undefined;

    if (parsedUniverseId !== undefined && isNaN(parsedUniverseId)) {
      ctx.set.status(400);
      return { error: "universeId deve ser um número" };
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
      ctx.set.status(500);
      return { error: "Erro ao listar chaves de API" };
    }
  }, {
    query: t.Object({
      universeId: t.Optional(t.Number())
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
      ctx.set.status(500);
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