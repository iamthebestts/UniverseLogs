import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock db FIRST before importing any services
vi.mock("@/db/client", () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{
      universe_id: BigInt(123),
      name: "Test Universe",
      description: "Desc",
      metadata: {},
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    transaction: vi.fn((cb) => cb({ insert: vi.fn().mockReturnThis(), values: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([{ universe_id: BigInt(123) }]) })),
  },
}));

// Mock env before other imports
vi.mock("@/env", () => ({
  env: {
    MASTER_KEY: "test-master-key",
    PORT: 0,
    DATABASE_URL: "postgres://mock",
    AUTO_CREATE_UNIVERSE: true,
    FETCH_ROBLOX_API: true,
  },
}));

// Mock api-keys service
vi.mock("@/services/api-keys.service", () => ({
  validateApiKey: vi.fn().mockResolvedValue({ universeId: BigInt(1) }),
  createApiKey: vi.fn().mockResolvedValue({ key: "mock-key" }),
}));

// Mock universes service (full mock override)
vi.mock("@/services/universes.service", () => ({
  createUniverse: vi.fn().mockResolvedValue({
    universe_id: BigInt(123),
    name: "Test Universe",
    description: "Desc",
    metadata: {},
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  }),
  revokeUniverse: vi.fn().mockResolvedValue(undefined),
  getUniverse: vi.fn().mockResolvedValue({
    universe_id: BigInt(123),
    name: "Test Universe",
    description: "Desc",
    metadata: {},
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  }),
  listUniverseLogs: vi.fn().mockResolvedValue([
    { id: "1", level: "info", message: "Universe created", universe_id: BigInt(123) },
  ]),
  ensureUniverseExists: vi.fn(),
}));

import { env } from "@/env";
import { buildApp } from "@/server/server";
import { createUniverse, revokeUniverse, getUniverse, listUniverseLogs } from "@/services/universes.service";
import { createApiKey, validateApiKey } from "@/services/api-keys.service";

describe("Universes Service & Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.MASTER_KEY = "test-master-key";
    env.AUTO_CREATE_UNIVERSE = true;
    env.FETCH_ROBLOX_API = true;
  });

  it("internal creation: creates with UniverseId when FETCH_ROBLOX_API=true", async () => {
    const app = await buildApp();
    const res = await app.handle(
      new Request("http://localhost/internal/universes/create", {
        method: "POST",
        headers: {
          "x-master-key": env.MASTER_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ universeId: 123 }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(createUniverse).toHaveBeenCalled();
    expect(body.universe_id).toBeDefined();
  });

  it("public creation: creates universe and returns api key", async () => {
    (validateApiKey as any).mockResolvedValue({ universeId: BigInt(1) });
    const app = await buildApp();
    const res = await app.handle(
      new Request("http://localhost/api/universes", {
        method: "POST",
        headers: {
          "x-api-key": "valid-key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ universeId: 456, name: "Manual Name" }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(createUniverse).toHaveBeenCalled();
    expect(createApiKey).toHaveBeenCalled();
    expect(body.key).toBe("mock-key");
  });

  it("public revoke: revokes universe and keys", async () => {
    const app = await buildApp();
    const res = await app.handle(
      new Request("http://localhost/api/universes/456/revoke", {
        method: "POST",
        headers: { "x-api-key": "valid-key" },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(revokeUniverse).toHaveBeenCalled();
    expect(body.success).toBe(true);
  });

  it("public consult: returns universe and logs", async () => {
    const app = await buildApp();
    const res = await app.handle(
      new Request("http://localhost/api/universes/123", {
        method: "GET",
        headers: { "x-api-key": "valid-key" },
      })
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
    const app = await buildApp();
    const res = await app.handle(
      new Request("http://localhost/api/universes", {
        method: "POST",
        headers: {
          "x-api-key": "valid-key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ universeId: 789, name: "Manual" }),
      })
    );
    expect(res.status).toBe(200);
    expect(createUniverse).toHaveBeenCalledWith(BigInt(789), { name: "Manual", description: undefined, extra: {} });
  });

  it("internal creation fails when FETCH_ROBLOX_API=false and no manual data", async () => {
    env.FETCH_ROBLOX_API = false;
    // Make service throw for missing metadata
    (createUniverse as any).mockRejectedValueOnce(new Error("FETCH_ROBLOX_API desabilitado e metadados ausentes; forneça nome e dados."));
    const app = await buildApp();
    const res = await app.handle(
      new Request("http://localhost/internal/universes/create", {
        method: "POST",
        headers: {
          "x-master-key": env.MASTER_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ universeId: 999 }),
      })
    );
    expect(res.status).toBe(500);
  });
});
