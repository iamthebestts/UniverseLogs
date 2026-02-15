import { createUniverse } from "@/services/universes.service";
import { t } from "elysia";
import type { RouteApp } from "../server";
import { ValidationError } from "../errors";

const parseUniverseId = (value: unknown): bigint | null => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value) || !Number.isSafeInteger(value))
      return null;
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

export default function registerInternalUniverseRoutes(app: RouteApp) {
  app.post<{ universeId: number | string }>(
    "/universes/create",
    async (ctx) => {
      const { universeId } = ctx.body;
      const parsed = parseUniverseId(universeId);
      if (parsed === null) {
        throw new ValidationError(
          "universeId é obrigatório e deve ser um inteiro ou string numérica"
        );
      }

      const universe = await createUniverse(parsed);
      return universe;
    },
    {
      body: t.Object({
        universeId: t.Union([t.Number(), t.String()]),
      }),
      authRequired: true,
    }
  );

  return "internal";
}
