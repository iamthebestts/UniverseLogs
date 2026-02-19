import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logBuffer } from "@/core/log-buffer";
import { db } from "@/db/client";
import { wsManager } from "@/server/websocket/manager";

const mockLogRows = (overrides: Partial<Record<string, unknown>>[] = []) =>
  overrides.map((o, i) => ({
    id: `log-${i}`,
    universe_id: BigInt(123),
    level: "info" as const,
    message: "msg",
    metadata: {},
    topic: null,
    timestamp: new Date(),
    ...o,
  }));

let mockListResolve: any[] = [];
let mockCountResolve: { count: number }[] = [{ count: 0 }];
let mockLevelRowsResolve: { level: string; count: number }[] = [];
let mockDeletedResolve: { id: string }[] = [];

function createChain() {
  const chain: any = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => Promise.resolve(mockListResolve)),
    groupBy: vi.fn().mockReturnThis(),
    execute: vi.fn().mockImplementation(() => Promise.resolve(mockListResolve)),
  };

  chain.groupBy.mockImplementation(() => {
    return Promise.resolve(
      mockLevelRowsResolve.length > 0 ? mockLevelRowsResolve : mockCountResolve,
    );
  });

  return chain;
}

// Mock env module which is safe
vi.mock("@/env", () => ({
  env: { NODE_ENV: "test", DATABASE_URL: "postgres://mock" },
}));

import {
  createLogsBulk,
  deleteLogs,
  getLogsCount,
  LOGS_LIST_MAX_LIMIT,
  listLogs,
} from "@/services/logs.service";

describe("logs.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListResolve = [];
    mockCountResolve = [{ count: 0 }];
    mockLevelRowsResolve = [];
    mockDeletedResolve = [];

    // Setup spies for singletons to avoid global leakage in Bun
    vi.spyOn(logBuffer, "add").mockImplementation(() => {});
    vi.spyOn(wsManager, "broadcast").mockImplementation(() => {});

    vi.spyOn(db, "select").mockImplementation((arg?: any) => {
      const chain = createChain();
      const hasCountOnly = arg && typeof arg === "object" && "count" in arg && !("level" in arg);
      if (hasCountOnly) {
        chain.where.mockImplementation(() => Promise.resolve(mockCountResolve));
      }
      return chain;
    });

    const mockInsertChain = {
      values: vi.fn().mockReturnThis(),
      onConflictDoNothing: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    };
    vi.spyOn(db, "insert").mockReturnValue(mockInsertChain as any);

    vi.spyOn(db, "transaction").mockImplementation((cb: (tx: any) => Promise<any>) => {
      const tx = {
        insert: vi.fn().mockReturnValue(mockInsertChain),
        values: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockImplementation(() => Promise.resolve(mockListResolve)),
        }),
      };
      return cb(tx);
    });

    vi.spyOn(db, "delete").mockImplementation(
      () =>
        ({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockImplementation(() => Promise.resolve(mockDeletedResolve)),
          }),
        }) as any,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("listLogs", () => {
    it("filters by level", async () => {
      mockListResolve = mockLogRows([{ level: "warn" }]);
      const rows = await listLogs(BigInt(1), { level: "warn" });
      expect(rows).toHaveLength(1);
      expect(rows[0]?.level).toBe("warn");
    });

    it("filters by topic", async () => {
      mockListResolve = mockLogRows([{ topic: "payments" }]);
      const rows = await listLogs(BigInt(1), { topic: "payments" });
      expect(rows).toHaveLength(1);
      expect(rows[0]?.topic).toBe("payments");
    });

    it("applies date range via from/to", async () => {
      mockListResolve = mockLogRows([{}, {}]);
      const from = new Date("2025-01-01");
      const to = new Date("2025-01-31");
      const rows = await listLogs(BigInt(1), { from, to });
      expect(rows).toHaveLength(2);
    });

    it("enforces limit cap at 100", async () => {
      mockListResolve = mockLogRows(Array.from({ length: 200 }, () => ({})));
      const chain = createChain();
      vi.spyOn(db, "select").mockReturnValue(chain);

      const rows = await listLogs(BigInt(1), { limit: 200 });
      expect(chain.limit).toHaveBeenCalledWith(LOGS_LIST_MAX_LIMIT);
      expect(rows.length).toBe(200);
    });

    it("uses cursor when cursor_ts and cursor_id provided", async () => {
      const ts = new Date("2025-02-01T12:00:00Z");
      mockListResolve = mockLogRows([{ id: "after-cursor", timestamp: ts }]);
      const rows = await listLogs(BigInt(1), {
        cursorTimestamp: ts,
        cursorId: "cursor-id",
        limit: 10,
      });
      expect(rows).toHaveLength(1);
    });
  });

  describe("createLogsBulk", () => {
    it("inserts multiple logs and preserves order", async () => {
      const inserted = mockLogRows([
        { id: "a", message: "first" },
        { id: "b", message: "second" },
      ]);
      mockListResolve = [...inserted];
      const result = await createLogsBulk(BigInt(1), [
        { level: "info", message: "first" },
        { level: "info", message: "second" },
      ]);
      expect(result).toHaveLength(2);
      expect(result[0]?.message).toBe("first");
      expect(result[1]?.message).toBe("second");
    });

    it("runs in transaction", async () => {
      mockListResolve = mockLogRows([{ id: "tx-log" }]);
      await createLogsBulk(BigInt(1), [{ level: "info", message: "tx" }]);
      expect(db.transaction).toHaveBeenCalled();
    });
  });

  describe("deleteLogs", () => {
    it("returns correct deleted count", async () => {
      mockDeletedResolve = [{ id: "1" }, { id: "2" }];
      const deleted = await deleteLogs(BigInt(1), {
        olderThan: new Date("2025-01-01"),
      });
      expect(deleted).toBe(2);
    });

    it("scopes by universe_id and respects level/topic", async () => {
      mockDeletedResolve = [];
      const deleted = await deleteLogs(BigInt(99), {
        olderThan: new Date(),
        level: "error",
        topic: "billing",
      });
      expect(deleted).toBe(0);
      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe("getLogsCount", () => {
    it("returns correct total and byLevel", async () => {
      mockCountResolve = [{ count: 10 }];
      mockLevelRowsResolve = [
        { level: "info", count: 5 },
        { level: "warn", count: 3 },
        { level: "error", count: 2 },
      ];
      const result = await getLogsCount(BigInt(1));
      expect(result.total).toBe(10);
      expect(result.byLevel.info).toBe(5);
      expect(result.byLevel.warn).toBe(3);
      expect(result.byLevel.error).toBe(2);
    });

    it("respects date range", async () => {
      mockCountResolve = [{ count: 3 }];
      mockLevelRowsResolve = [];
      const result = await getLogsCount(BigInt(1), {
        from: new Date("2025-01-01"),
        to: new Date("2025-01-31"),
      });
      expect(result.total).toBe(3);
    });
  });
});
