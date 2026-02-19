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

  it("full REST flow: create, bulk, list with filters, cursor, count, delete, confirm", async () => {
    const universeId = "987654321";
    const createKeyRes = await app.handle(
      new Request("http://localhost/internal/keys/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-master-key": env.MASTER_KEY,
        },
        body: JSON.stringify({ universeId }),
      }),
    );
    expect(createKeyRes.status).toBe(200);
    const { key: apiKey } = await createKeyRes.json();
    expect(apiKey).toBeDefined();

    const base = "http://localhost";
    const headers = (h: Record<string, string>) => ({
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      ...h,
    });

    const singleRes = await app.handle(
      new Request(`${base}/api/logs`, {
        method: "POST",
        headers: headers({}),
        body: JSON.stringify({
          level: "info",
          message: "REST flow single",
          topic: "e2e-flow",
        }),
      }),
    );
    expect(singleRes.status).toBe(200);
    await new Promise((r) => setTimeout(r, 500));

    const bulkRes = await app.handle(
      new Request(`${base}/api/logs/bulk`, {
        method: "POST",
        headers: headers({}),
        body: JSON.stringify({
          logs: [
            { level: "warn", message: "Bulk 1", topic: "e2e-flow" },
            { level: "error", message: "Bulk 2", topic: "e2e-flow" },
          ],
        }),
      }),
    );
    if (bulkRes.status !== 200) {
      const errBody = await bulkRes.json().catch(() => ({}));
      throw new Error(`POST /api/logs/bulk failed: ${bulkRes.status} ${JSON.stringify(errBody)}`);
    }
    const bulkData = await bulkRes.json();
    expect(bulkData.logs).toHaveLength(2);
    await new Promise((r) => setTimeout(r, 500));

    const listRes = await app.handle(
      new Request(`${base}/api/logs?level=info&topic=e2e-flow&limit=5`, {
        headers: { "x-api-key": apiKey },
      }),
    );
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(Array.isArray(listData.logs)).toBe(true);
    const firstPageLength = listData.logs.length;

    if (firstPageLength > 0 && listData.nextCursor) {
      const cursorRes = await app.handle(
        new Request(
          `${base}/api/logs?topic=e2e-flow&cursor_ts=${listData.nextCursor.timestamp}&cursor_id=${listData.nextCursor.id}&limit=5`,
          { headers: { "x-api-key": apiKey } },
        ),
      );
      expect(cursorRes.status).toBe(200);
    }

    const countRes = await app.handle(
      new Request(`${base}/api/logs/count`, {
        headers: { "x-api-key": apiKey },
      }),
    );
    expect(countRes.status).toBe(200);
    const countBefore = await countRes.json();
    expect(typeof countBefore.total).toBe("number");
    expect(countBefore.byLevel).toBeDefined();

    const oldDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const deleteRes = await app.handle(
      new Request(`${base}/api/logs?olderThan=${encodeURIComponent(oldDate)}`, {
        method: "DELETE",
        headers: { "x-api-key": apiKey },
      }),
    );
    expect(deleteRes.status).toBe(200);
    const deleteData = await deleteRes.json();
    expect(typeof deleteData.deleted).toBe("number");

    const countAfterRes = await app.handle(
      new Request(`${base}/api/logs/count`, {
        headers: { "x-api-key": apiKey },
      }),
    );
    expect(countAfterRes.status).toBe(200);
    const countAfter = await countAfterRes.json();
    expect(countAfter.total).toBe(countBefore.total - deleteData.deleted);
  });
});
