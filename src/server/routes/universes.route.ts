import { createApiKey } from "@/services/api-keys.service";
import { createUniverse, getUniverse, listUniverseLogs, revokeUniverse } from "@/services/universes.service";
import { t } from "elysia";
import type { RouteApp } from "../server";
import { ValidationError } from "../errors";
import { serialize } from "../utils/serialization";

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
    { authRequired: true }
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
    { authRequired: true }
  );

  return "api";
}
