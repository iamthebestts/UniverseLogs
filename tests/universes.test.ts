import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";

// Mock env FIRST before importing any services
vi.mock("@/env", () => ({
  env: {
    NODE_ENV: "test",
    MASTER_KEY: "test-master-key",
    PORT: 0,
    DATABASE_URL: "postgres://mock",
    AUTO_CREATE_UNIVERSE: true,
    FETCH_ROBLOX_API: true,
  },
}));

// Mock services that we want to isolate routes from
vi.mock("@/services/api-keys.service", () => ({
  validateApiKey: vi.fn(),
  createApiKey: vi.fn(),
}));

vi.mock("@/services/universes.service", () => ({
  createUniverse: vi.fn(),
  revokeUniverse: vi.fn(),
  getUniverse: vi.fn(),
  listUniverseLogs: vi.fn(),
  ensureUniverseExists: vi.fn(),
}));

import { env } from "@/env";
import { buildApp } from "@/server/server";
import { createApiKey, validateApiKey } from "@/services/api-keys.service";
import {
  createUniverse,
  getUniverse,
  listUniverseLogs,
  revokeUniverse,
} from "@/services/universes.service";

const MOCK_UNIVERSE = {
  universe_id: "123",
  name: "Test Universe",
  description: "Desc",
  metadata: {},
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("Universes Service & Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.MASTER_KEY = "test-master-key";
    env.AUTO_CREATE_UNIVERSE = true;
    env.FETCH_ROBLOX_API = true;

    // Use spies for db to avoid leakage
    const mockChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([MOCK_UNIVERSE]),
      onConflictDoNothing: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
    };

    vi.spyOn(db, "insert").mockReturnValue(mockChain as any);
    vi.spyOn(db, "select").mockReturnValue(mockChain as any);
    vi.spyOn(db, "update").mockReturnValue(mockChain as any);
    vi.spyOn(db, "delete").mockReturnValue(mockChain as any);

    vi.spyOn(db, "transaction").mockImplementation(((cb: any) =>
      cb({
        insert: vi.fn().mockReturnValue(mockChain),
        select: vi.fn().mockReturnValue(mockChain),
        update: vi.fn().mockReturnValue(mockChain),
        delete: vi.fn().mockReturnValue(mockChain),
      } as any)) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("internal creation: creates with UniverseId when FETCH_ROBLOX_API=true", async () => {
    (createUniverse as any).mockResolvedValue({
      ...MOCK_UNIVERSE,
      universe_id: BigInt(123),
    });
    const app = await buildApp();
    const res = await app.handle(
      new Request("http://localhost/internal/universes/create", {
        method: "POST",
        headers: {
          "x-master-key": env.MASTER_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ universeId: 123 }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(createUniverse).toHaveBeenCalled();
    expect(body.universe_id).toBeDefined();
  });

  it("public creation: creates universe and returns api key", async () => {
    (validateApiKey as any).mockResolvedValue({ universeId: BigInt(1) });
    (createUniverse as any).mockResolvedValue({
      ...MOCK_UNIVERSE,
      universe_id: "456",
    });
    (createApiKey as any).mockResolvedValue({ key: "mock-key" });

    const app = await buildApp();
    const res = await app.handle(
      new Request("http://localhost/api/universes", {
        method: "POST",
        headers: {
          "x-api-key": "valid-key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ universeId: 456, name: "Manual Name" }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(createUniverse).toHaveBeenCalled();
    expect(createApiKey).toHaveBeenCalled();
    expect(body.key).toBe("mock-key");
  });

  it("public revoke: revokes universe and keys", async () => {
    (validateApiKey as any).mockResolvedValue({ universeId: BigInt(1) });
    (revokeUniverse as any).mockResolvedValue(undefined);

    const app = await buildApp();
    const res = await app.handle(
      new Request("http://localhost/api/universes/456/revoke", {
        method: "POST",
        headers: { "x-api-key": "valid-key" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(revokeUniverse).toHaveBeenCalled();
    expect(body.success).toBe(true);
  });

  it("public consult: returns universe and logs", async () => {
    (validateApiKey as any).mockResolvedValue({ universeId: BigInt(1) });
    (getUniverse as any).mockResolvedValue({
      ...MOCK_UNIVERSE,
      universe_id: "123",
    });
    (listUniverseLogs as any).mockResolvedValue([]);

    const app = await buildApp();
    const res = await app.handle(
      new Request("http://localhost/api/universes/123", {
        method: "GET",
        headers: { "x-api-key": "valid-key" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(getUniverse).toHaveBeenCalled();
    expect(listUniverseLogs).toHaveBeenCalled();
    expect(body.universe).toBeDefined();
    expect(Array.isArray(body.logs)).toBe(true);
  });

  it("creation without Roblox fetch requires manual data when FETCH_ROBLOX_API=false", async () => {
    env.FETCH_ROBLOX_API = false;
    (validateApiKey as any).mockResolvedValue({ universeId: BigInt(1) });
    (createUniverse as any).mockResolvedValue({
      ...MOCK_UNIVERSE,
      universe_id: "789",
    });
    (createApiKey as any).mockResolvedValue({ key: "k" });

    const app = await buildApp();
    const res = await app.handle(
      new Request("http://localhost/api/universes", {
        method: "POST",
        headers: {
          "x-api-key": "valid-key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ universeId: 789, name: "Manual" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(createUniverse).toHaveBeenCalledWith(BigInt(789), {
      name: "Manual",
      description: undefined,
      extra: {},
    });
  });

  it("internal creation fails when FETCH_ROBLOX_API=false and no manual data", async () => {
    env.FETCH_ROBLOX_API = false;
    // Make service throw for missing metadata
    (createUniverse as any).mockRejectedValueOnce(
      new Error("FETCH_ROBLOX_API desabilitado e metadados ausentes; forneça nome e dados."),
    );
    const app = await buildApp();
    const res = await app.handle(
      new Request("http://localhost/internal/universes/create", {
        method: "POST",
        headers: {
          "x-master-key": env.MASTER_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ universeId: 999 }),
      }),
    );
    expect(res.status).toBe(500);
  });
});
