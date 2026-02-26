import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { drizzleMock, postgresMock, setDefaultResultOrderMock } = vi.hoisted(() => ({
  drizzleMock: vi.fn((sqlClient: unknown) => ({ sqlClient })),
  postgresMock: vi.fn(() => ({ mocked: true })),
  setDefaultResultOrderMock: vi.fn(),
}));

vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: drizzleMock,
}));

vi.mock("postgres", () => ({
  default: postgresMock,
}));

vi.mock("node:dns", () => ({
  setDefaultResultOrder: setDefaultResultOrderMock,
}));

const ORIGINAL_ENV = process.env;

const mockBaseEnv = (databaseUrl: string) => {
  vi.doMock("@/env", () => ({
    env: {
      DATABASE_URL: databaseUrl,
      DB_MAX_CONNECTIONS: 10,
      DB_IDLE_TIMEOUT: 30,
    },
  }));
};

describe("db/client", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.DB_DISABLE_FORCE_IPV4;
    delete process.env.DB_SSL;
    delete process.env.DB_PREPARE_STATEMENTS;
    drizzleMock.mockClear();
    postgresMock.mockClear();
    setDefaultResultOrderMock.mockClear();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("forca prioridade IPv4 por padrao", async () => {
    mockBaseEnv("postgresql://user:pass@localhost:5432/logsdb");

    await import("@/db/client");

    expect(setDefaultResultOrderMock).toHaveBeenCalledWith("ipv4first");
  });

  it("permite desabilitar o forçamento de IPv4 via DB_DISABLE_FORCE_IPV4", async () => {
    process.env.DB_DISABLE_FORCE_IPV4 = "true";
    mockBaseEnv("postgresql://user:pass@localhost:5432/logsdb");

    await import("@/db/client");

    expect(setDefaultResultOrderMock).not.toHaveBeenCalled();
  });

  it("mantem defaults remotos para Supabase e permite override", async () => {
    mockBaseEnv("postgresql://user:pass@db.abc.supabase.co:5432/postgres");

    await import("@/db/client");

    expect(postgresMock).toHaveBeenCalledWith(
      "postgresql://user:pass@db.abc.supabase.co:5432/postgres",
      expect.objectContaining({
        max: 10,
        idle_timeout: 30,
        ssl: "require",
        prepare: false,
      }),
    );

    vi.resetModules();
    postgresMock.mockClear();
    setDefaultResultOrderMock.mockClear();

    process.env.DB_SSL = "false";
    process.env.DB_PREPARE_STATEMENTS = "true";
    mockBaseEnv("postgresql://user:pass@db.abc.supabase.co:5432/postgres");

    await import("@/db/client");

    expect(postgresMock).toHaveBeenCalledWith(
      "postgresql://user:pass@db.abc.supabase.co:5432/postgres",
      expect.objectContaining({
        ssl: false,
        prepare: true,
      }),
    );
  });
});
