import { beforeAll, describe, expect, it } from "vitest";
import { env } from "@/env";
import { buildApp } from "@/server/server";

describe("Logs E2E", () => {
  let app: any;

  beforeAll(async () => {
    app = await buildApp();
  });

  it("should create an API key using Master Key and then send a log", async () => {
    const universeId = "123456789";

    // 1. Criar um universo (ou garantir que ele exista)
    // A API pode criá-lo automaticamente se estiver configurada, mas vamos ser explícitos se houver um endpoint.
    // Com base na lista de arquivos, existe o universes.internal.route.ts

    // 2. Criar uma chave de API
    const createKeyResponse = await app.handle(
      new Request("http://localhost/internal/keys/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-master-key": env.MASTER_KEY,
        },
        body: JSON.stringify({
          universeId: universeId,
        }),
      }),
    );

    expect(createKeyResponse.status).toBe(200);
    const keyData = await createKeyResponse.json();
    const apiKey = keyData.key;
    expect(apiKey).toBeDefined();

    // 3. Enviar um log usando a nova chave de API
    const logPayload = {
      level: "info",
      message: "Hello from E2E test",
      topic: "e2e-testing",
      metadata: { foo: "bar" },
    };

    const sendLogResponse = await app.handle(
      new Request("http://localhost/api/logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify(logPayload),
      }),
    );

    expect(sendLogResponse.status).toBe(200);
    const logData = await sendLogResponse.json();
    expect(logData.id).toBeDefined();
    expect(logData.message).toBe(logPayload.message);

    await new Promise((resolve) => setTimeout(resolve, 200));

    // 4. Buscar o log
    const getLogResponse = await app.handle(
      new Request(`http://localhost/api/logs/${logData.id}`, {
        headers: {
          "x-api-key": apiKey,
        },
      }),
    );

    expect(getLogResponse.status).toBe(200);
    const retrievedLog = await getLogResponse.json();
    expect(retrievedLog.message).toBe(logPayload.message);
    expect(retrievedLog.topic).toBe(logPayload.topic);
  });

  it("should fail to send a log with invalid API key", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "invalid-key",
        },
        body: JSON.stringify({
          level: "info",
          message: "Should fail",
        }),
      }),
    );

    expect(response.status).toBe(401);
  });
});
