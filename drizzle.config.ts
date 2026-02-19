import { config } from "dotenv";
import type { Config } from "drizzle-kit";

const env = process.env.NODE_ENV ?? "development";

config({
  path: [`.env.${env}.local`, `.env.${env}`, ".env.local", ".env"],
});

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não definida");
}

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
