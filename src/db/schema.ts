import { bigint, boolean, index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const logLevel = pgEnum("log_level", ["info", "warn", "error"]);

export const games = pgTable("games", {
  universe_id: bigint("universe_id", { mode: "bigint" }).primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  metadata: jsonb("metadata").default({}),
  is_active: boolean("is_active").default(true).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }),
});

export const api_keys = pgTable("api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(), // hashed key
  is_active: boolean("is_active").default(true).notNull(),
  universe_id: bigint("universe_id", { mode: "bigint" }).references(() => games.universe_id).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  revoked_at: timestamp("revoked_at", { withTimezone: true }),
  last_used_at: timestamp("last_used_at", { withTimezone: true }),
});

export const logs = pgTable(
  "logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    universe_id: bigint("universe_id", { mode: "bigint" })
      .references(() => games.universe_id)
      .notNull(),
    level: logLevel("level").notNull(),
    message: text("message").notNull(),
    metadata: jsonb("metadata").default({}),
    topic: text("topic"),
    timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    universeIdx: index("logs_universe_idx").on(table.universe_id),
    timeIdx: index("logs_time_idx").on(table.timestamp),
    universeTimeIdx: index("logs_universe_time_idx").on(
      table.universe_id,
      table.timestamp
    ),
  })
);