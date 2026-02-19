import { z } from "zod";
import { validateEnv } from "@/core/env.validate";

const envBoolean = (defaultValue: boolean) =>
  z
    .union([z.boolean(), z.string()])
    .transform((v) => {
      if (typeof v === "boolean") return v;
      const s = String(v).trim().toLowerCase();
      if (s === "" || s === "false" || s === "0" || s === "no" || s === "off") return false;
      return true;
    })
    .default(defaultValue);

export const env = validateEnv(
  z.object({
    // Database
    DATABASE_URL: z.string("Database URL is required").min(1),
    RUN_MIGRATE: envBoolean(false),
    DB_MAX_CONNECTIONS: z.coerce.number().default(10),
    DB_IDLE_TIMEOUT: z.coerce.number().default(30),

    // API
    PORT: z.coerce.number().default(3000),
    HOST: z.string().default("0.0.0.0"),

    // Universe Management
    AUTO_CREATE_UNIVERSE: envBoolean(true),
    FETCH_ROBLOX_API: envBoolean(true),

    // Keys
    MASTER_KEY: z.string("Master key is required").min(1),

    // OTHERS
    NODE_ENV: z.enum(["dev", "prod", "test"]).default("prod"),
  }),
);
