import { runMigrations } from "@/db/migrate";

export async function setup() {
  console.log("Starting E2E Global Setup...");

  try {
    await runMigrations();
    console.log("Migrations applied successfully.");
  } catch (error) {
    console.error("Failed to run migrations:", error);
    process.exit(1);
  }
}

export async function teardown() {
  console.log("Ending E2E Global Teardown...");
}
