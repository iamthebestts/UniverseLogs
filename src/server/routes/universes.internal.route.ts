import { t } from "elysia";
import { createUniverse } from "@/services/universes.service";
import { ValidationError } from "../errors";
import type { RouteApp } from "../server";
import { parseUniverseId } from "../utils/parsing";
import { serialize } from "../utils/serialization";

export default function registerInternalUniverseRoutes(app: RouteApp) {
  app.post<{ universeId: number | string }>(
    "/universes/create",
    async (ctx) => {
      const { universeId } = ctx.body;
      const parsed = parseUniverseId(universeId);
      if (parsed === null) {
        throw new ValidationError(
          "universeId é obrigatório e deve ser um inteiro ou string numérica",
        );
      }

      const universe = await createUniverse(parsed);
      return serialize(universe);
    },
    {
      body: t.Object({
        universeId: t.Union([t.Number(), t.String()]),
      }),
      authRequired: true,
      detail: {
        tags: ["Internal", "Universes"],
        summary: "Criar Universo (Interno)",
        description:
          "Criação administrativa de universos, bypassando verificações públicas se necessário. Requer Master Key.",
        security: [{ MasterKeyAuth: [] }],
        responses: {
          200: { description: "Universo criado" },
          401: { description: "Master Key inválida" },
        },
      },
    },
  );

  return "internal";
}
