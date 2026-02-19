import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({ path: ".env.test" });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["e2e-tests/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    globalSetup: "./e2e-tests/global-setup.ts",
    setupFiles: ["./e2e-tests/setup.ts"],
    fileParallelism: false,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
