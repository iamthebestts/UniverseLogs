import { Elysia } from "elysia";

// Each route module exports a default function receiving the Elysia instance
export default function registerExampleRoutes(app: Elysia) {
  app
    .get("/health", () => ({ status: "ok" }))
    .get("/ping", () => ({ pong: true }));
}
