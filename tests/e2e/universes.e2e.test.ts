import { env } from "@/env";
import { buildApp } from "@/server/server";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

describe("Universes Management E2E", () => {
  let app: any;
  let masterApiKey: string;
  const testUniverseId = "1234567890";

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(async () => {
    // 1. Criar uma chave de API auxiliar para as rotas "api" dentro de CADA teste 
    const res = await app.handle(
      new Request("http://localhost/internal/keys/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-master-key": env.MASTER_KEY,
        },
        body: JSON.stringify({ universeId: testUniverseId }),
      })
    );
    expect(res.ok, `Setup failed to create master key: ${await res.clone().text()}`).toBe(true);
    const data = await res.json();
    expect(data.key, "Response body should contain API key").toBeDefined();
    masterApiKey = data.key;

    // 2. Garantir que o universo exista para testes que o esperam
    const setupUniRes = await app.handle(
      new Request("http://localhost/internal/universes/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-master-key": env.MASTER_KEY,
        },
        body: JSON.stringify({ universeId: testUniverseId }),
      })
    );
    expect(setupUniRes.ok, `Setup failed to ensure universe exists: ${await setupUniRes.clone().text()}`).toBe(true);
  });

  describe("Internal Management", () => {
    it("should create a universe via internal route using Master Key", async () => {
      const internalId = "555666777";
      const res = await app.handle(
        new Request("http://localhost/internal/universes/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-master-key": env.MASTER_KEY,
          },
          body: JSON.stringify({ universeId: internalId }),
        })
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.universe_id).toBe(internalId);
      expect(data.is_active).toBe(true);
    });

    it("should fail internal creation with invalid Master Key", async () => {
      const res = await app.handle(
        new Request("http://localhost/internal/universes/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-master-key": "wrong-key",
          },
          body: JSON.stringify({ universeId: "1" }),
        })
      );

      expect(res.status).toBe(401);
    });
  });

  describe("Public Management", () => {
    it("should register a new universe via public API", async () => {
      const newUniverseId = "111222333";
      const res = await app.handle(
        new Request("http://localhost/api/universes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": masterApiKey,
          },
          body: JSON.stringify({
            universeId: newUniverseId,
            name: "Public Universe",
            description: "Registered via API",
            createKey: true
          }),
        })
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.universe.universe_id).toBe(newUniverseId);
      expect(data.universe.name).toBe("Public Universe");
      expect(data.key).toBeDefined();
    });

    it("should get universe details and logs", async () => {
      // 1. Enviar um log primeiro para ver se aparece na lista
      await app.handle(
        new Request("http://localhost/api/logs", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": masterApiKey,
          },
          body: JSON.stringify({ level: "info", message: "Log for details check" }),
        })
      );

      // 2. Aguardar o flush do buffer
      await new Promise(r => setTimeout(r, 200));

      // 3. Buscar detalhes
      const res = await app.handle(
        new Request(`http://localhost/api/universes/${testUniverseId}`, {
          method: "GET",
          headers: {
            "x-api-key": masterApiKey,
          },
        })
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.universe.universe_id).toBe(testUniverseId);
      expect(data.logs).toBeInstanceOf(Array);
      expect(data.logs.length).toBeGreaterThan(0);
      expect(data.logs[0].message).toBe("Log for details check");
    });

    it("should revoke a universe and invalidate its keys", async () => {
      const targetId = "444555666";

      // 1. Criar universo e chave
      const regRes = await app.handle(
        new Request("http://localhost/api/universes", {
          method: "POST",
          headers: { "x-api-key": masterApiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ 
            universeId: targetId, 
            name: "To be revoked",
            createKey: true 
          }),
        })
      );
      const { key: targetKey } = await regRes.json();

      // 2. Verificar se a chave funciona
      const testRes = await app.handle(
        new Request("http://localhost/api/logs", {
          method: "POST",
          headers: { "x-api-key": targetKey, "Content-Type": "application/json" },
          body: JSON.stringify({ level: "info", message: "Pre-revoke" }),
        })
      );
      expect(testRes.status).toBe(200);

      // 3. Revogar via API
      const revokeRes = await app.handle(
        new Request(`http://localhost/api/universes/${targetId}/revoke`, {
          method: "POST",
          headers: { "x-api-key": targetKey },
        })
      );
      expect(revokeRes.status).toBe(200);

      // 4. Verificar se a chave não funciona mais
      const failRes = await app.handle(
        new Request("http://localhost/api/logs", {
          method: "POST",
          headers: { "x-api-key": targetKey, "Content-Type": "application/json" },
          body: JSON.stringify({ level: "info", message: "Post-revoke" }),
        })
      );
      expect(failRes.status).toBe(401);

      // 5. Verificar se o universo está inativo
      const checkRes = await app.handle(
        new Request(`http://localhost/api/universes/${targetId}`, {
          method: "GET",
          headers: { "x-api-key": masterApiKey }, // Usar chave mestra já que a chave alvo foi revogada
        })
      );
      const checkData = await checkRes.json();
      expect(checkData.universe.is_active).toBe(false);
    });
  });
});
