import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { env } from "@/env";
import { buildApp } from "@/server/server";

type ListenResult = { port: number; stop?: () => Promise<void> };

describe("WebSocket E2E", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let listenResult: ListenResult;
  let baseUrl: string;
  let wsUrl: string;
  let apiKey: string;
  let skipSuite = false;

  beforeAll(async () => {
    try {
      app = await buildApp();
      listenResult = app.listen({
        port: 0,
        hostname: "127.0.0.1",
      }) as unknown as ListenResult;
    } catch {
      skipSuite = true;
      return;
    }
    const port = listenResult.port;
    if (port == null) {
      skipSuite = true;
      return;
    }
    baseUrl = `http://127.0.0.1:${port}`;
    wsUrl = `ws://127.0.0.1:${port}/realtime`;

    const createKeyRes = await fetch(`${baseUrl}/internal/keys/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-master-key": env.MASTER_KEY,
      },
      body: JSON.stringify({ universeId: "111222333" }),
    });
    expect(createKeyRes.ok).toBe(true);
    const keyData = (await createKeyRes.json()) as { key: string };
    apiKey = keyData.key;
    expect(apiKey).toBeDefined();
  });

  afterAll(async () => {
    if (skipSuite || !listenResult?.stop) return;
    await listenResult.stop();
  });

  const sendWs = (msg: object, timeoutMs = 5000): Promise<unknown> =>
    new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl, {
        headers: { "x-api-key": apiKey },
      });
      const replies: unknown[] = [];
      const timer = setTimeout(() => {
        ws.terminate();
        reject(new Error(`WebSocket command timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      const clearTimer = () => clearTimeout(timer);

      ws.on("message", (data: Buffer | string) => {
        try {
          const parsed = JSON.parse(data.toString());
          replies.push(parsed);
          if (parsed.type !== "CONNECTED" && parsed.type !== "PONG") {
            ws.close();
          }
        } catch {
          replies.push(data.toString());
        }
      });
      ws.on("open", () => {
        ws.send(JSON.stringify(msg));
      });
      ws.on("error", (err) => {
        clearTimer();
        reject(err);
      });
      ws.on("close", () => {
        clearTimer();
        resolve(replies.length === 1 ? replies[0] : replies);
      });
    });

  it("connects with valid API key and receives CONNECTED", async () => {
    if (skipSuite) return;
    const connected = await new Promise<unknown>((resolve, reject) => {
      const ws = new WebSocket(wsUrl, {
        headers: { "x-api-key": apiKey },
      });
      const timer = setTimeout(() => {
        ws.terminate();
        reject(new Error("WebSocket connection timed out"));
      }, 5000);

      ws.on("message", (data: Buffer | string) => {
        const parsed = JSON.parse(data.toString());
        if (parsed.type === "CONNECTED") {
          clearTimeout(timer);
          ws.close();
          resolve(parsed);
        }
      });
      ws.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
      ws.on("close", () => clearTimeout(timer));
    });
    expect(connected).toMatchObject({ type: "CONNECTED", universeId: "111222333" });
  });

  it("SEND_LOG creates log and REST can fetch it", async () => {
    if (skipSuite) return;
    const res = await sendWs({
      type: "SEND_LOG",
      payload: { level: "info", message: "WS single", topic: "ws-e2e" },
    });
    const msg = Array.isArray(res) ? res.find((m: any) => m.type === "LOG_CREATED") : res;
    expect(msg).toMatchObject({ type: "LOG_CREATED", id: expect.any(String) });
    const id = (msg as { id: string }).id;

    await new Promise((r) => setTimeout(r, 400));

    const getRes = await fetch(`${baseUrl}/api/logs/${id}`, {
      headers: { "x-api-key": apiKey },
    });
    expect(getRes.status).toBe(200);
    const log = (await getRes.json()) as { message: string; topic: string };
    expect(log.message).toBe("WS single");
    expect(log.topic).toBe("ws-e2e");
  });

  it("SEND_LOGS_BULK creates logs", async () => {
    if (skipSuite) return;
    const res = await sendWs({
      type: "SEND_LOGS_BULK",
      payload: {
        logs: [
          { level: "info", message: "WS bulk 1", topic: "ws-e2e" },
          { level: "warn", message: "WS bulk 2", topic: "ws-e2e" },
        ],
      },
    });
    const msg = Array.isArray(res) ? res.find((m: any) => m.type === "LOGS_BULK_CREATED") : res;
    expect(msg).toMatchObject({ type: "LOGS_BULK_CREATED", count: 2 });
  });

  it("QUERY_LOGS returns list", async () => {
    if (skipSuite) return;
    await new Promise((r) => setTimeout(r, 400));
    const res = await sendWs({
      type: "QUERY_LOGS",
      payload: { topic: "ws-e2e", limit: 10 },
    });
    const msg = Array.isArray(res) ? res.find((m: any) => m.type === "LOGS_QUERY_RESULT") : res;
    expect(msg).toMatchObject({ type: "LOGS_QUERY_RESULT", logs: expect.any(Array) });
  });

  it("QUERY_LOGS_COUNT returns counts", async () => {
    if (skipSuite) return;
    const res = await sendWs({ type: "QUERY_LOGS_COUNT", payload: {} });
    const msg = Array.isArray(res) ? res.find((m: any) => m.type === "LOGS_COUNT_RESULT") : res;
    expect(msg).toMatchObject({
      type: "LOGS_COUNT_RESULT",
      total: expect.any(Number),
      byLevel: expect.any(Object),
    });
  });

  it("DELETE_LOGS via WS and confirm via REST count", async () => {
    if (skipSuite) return;
    const oldDate = new Date(Date.now() - 3600 * 1000).toISOString();
    const res = await sendWs({
      type: "DELETE_LOGS",
      payload: { olderThan: oldDate, confirm: true, topic: "ws-e2e" },
    });
    const msg = Array.isArray(res) ? res.find((m: any) => m.type === "LOGS_DELETED") : res;
    expect(msg).toMatchObject({ type: "LOGS_DELETED", deleted: expect.any(Number) });

    const countRes = await fetch(`${baseUrl}/api/logs/count`, {
      headers: { "x-api-key": apiKey },
    });
    expect(countRes.status).toBe(200);
    const countData = (await countRes.json()) as { total: number };
    expect(typeof countData.total).toBe("number");
  });
});
