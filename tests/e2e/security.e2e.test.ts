import { env } from "@/env";
import { buildApp } from "@/server/server";
import { beforeAll, describe, expect, it } from "vitest";

describe("Security & Rate Limit E2E", () => {
  let app: any;

  beforeAll(async () => {
    app = await buildApp();
  });

  describe("API Key Revocation", () => {
    it("should revoke an API key and block further requests", async () => {
      const universeId = "999888777";

      // 1. Criar uma nova chave de API
      const createKeyRes = await app.handle(
        new Request("http://localhost/internal/keys/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-master-key": env.MASTER_KEY,
          },
          body: JSON.stringify({ universeId }),
        })
      );
      expect(createKeyRes.status, `Failed to create API key: ${await createKeyRes.clone().text()}`).toBe(200);
      const { key: apiKey } = await createKeyRes.json();

      // 2. Verificar se a chave funciona
      const workRes = await app.handle(
        new Request("http://localhost/api/logs", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({ level: "info", message: "Key working" }),
        })
      );
      expect(workRes.status).toBe(200);

      // 3. Revogar a chave
      const revokeRes = await app.handle(
        new Request("http://localhost/internal/keys/revoke", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-master-key": env.MASTER_KEY,
          },
          body: JSON.stringify({ key: apiKey }),
        })
      );
      expect(revokeRes.status).toBe(200);

      // 4. Verificar se está bloqueado (401)
      const blockedRes = await app.handle(
        new Request("http://localhost/api/logs", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({ level: "info", message: "Should be blocked" }),
        })
      );
      expect(blockedRes.status).toBe(401);
    });
  });

  describe("Rate Limit Exhaustion", () => {
    it("should return 429 when rate limit is exceeded on anonymous route", async () => {
      // A rota /api/ping tem um limite de 60 requisições por minuto
      // Vamos realizar 60 requisições e a 61ª deve falhar.

      const results: Response[] = [];
      for (let i = 0; i < 60; i++) {
        results.push(await app.handle(new Request("http://localhost/api/ping")));
      }

      // Todas as primeiras 60 devem retornar 200
      results.forEach((res, i) => {
        expect(res.status, `Request ${i + 1} failed`).toBe(200);
      });

      // A 61ª deve retornar 429
      const exhaustedRes = await app.handle(new Request("http://localhost/api/ping"));
      expect(exhaustedRes.status).toBe(429);

      const errorBody = await exhaustedRes.json();
      expect(errorBody.error).toContain("Rate limit excedido");
    });

    it("should return 429 when rate limit is exceeded on authenticated route", async () => {
      // 1. Criar uma chave
      const createKeyRes = await app.handle(
        new Request("http://localhost/internal/keys/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-master-key": env.MASTER_KEY,
          },
          body: JSON.stringify({ universeId: "111" }),
        })
      );
      expect(createKeyRes.ok, `Key registration failed with status ${createKeyRes.status}`).toBe(true);
      const { key: apiKey } = await createKeyRes.json();
      expect(typeof apiKey, "apiKey must be a non-empty string").toBe("string");
      expect(apiKey.length).toBeGreaterThan(0);

      // 2. A rota /api/logs tem um limite de 100 requisições por minuto
      // Usamos um loop menor se possível, mas vamos manter o limite real.
      // 100 requisições ainda é rápido.

      for (let i = 0; i < 100; i++) {
        const res = await app.handle(
          new Request("http://localhost/api/logs", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
            },
            body: JSON.stringify({ level: "info", message: `Log ${i}` }),
          })
        );
        expect(res.status).toBe(200);
      }

      // A 101ª deve retornar 429
      const exhaustedRes = await app.handle(
        new Request("http://localhost/api/logs", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({ level: "info", message: "Final log" }),
        })
      );

      expect(exhaustedRes.status).toBe(429);
    });
  });
});
