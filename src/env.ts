import { validateEnv } from "@/core/env.validate";
import { z } from "zod";

export const env = validateEnv(
    z.object({
        // Database
        DATABASE_URL: z.string("Database URL is required").min(1),

        // API
        PORT: z.coerce.number().default(3000),
        USE_AUTH: z.coerce.boolean().default(true),

        // Universe Management
        AUTO_CREATE_UNIVERSE: z.coerce.boolean().default(true),
        FETCH_ROBLOX_API: z.coerce.boolean().default(true),

        // Keys
        MASTER_KEY: z.string("Master key is required").min(1),

        // OTHERS
        NODE_ENV: z.enum(["dev", "prod"]).default("prod"),
    }),
)