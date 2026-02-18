import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";
import { config } from "dotenv";

config({ path: ".env.test" });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/e2e/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    globalSetup: "./tests/e2e/global-setup.ts",
    setupFiles: ["./tests/e2e/setup.ts"],
    fileParallelism: false, // E2E tests often depend on shared resources like DB
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
