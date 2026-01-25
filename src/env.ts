import { validateEnv } from "@/core/env.validate";
import { z } from "zod";

const parseBoolean = (value: unknown) => {
    if (typeof value === "boolean") return value
    if (typeof value === "number") return value === 1
    if (typeof value !== "string") return value

    const normalized = value.trim().toLowerCase()
    if (["true", "1", "yes", "y", "on"].includes(normalized)) return true
    if (["false", "0", "no", "n", "off"].includes(normalized)) return false
    return value
}

export const env = validateEnv(
    z.object({
        // Database
        DATABASE_URL: z.string("Database URL is required").min(1),

        // API
        PORT: z.coerce.number().default(3000),
        USE_AUTH: z.preprocess(parseBoolean, z.boolean()).default(true),

        // Keys
        MASTER_KEY: z.string("Master key is required").min(1),

        // OTHERS
        NODE_ENV: z.enum(["dev", "prod"]).default("prod"),
    }),
)

// NOTE: Do not override USE_AUTH in production; explicit env should win.
