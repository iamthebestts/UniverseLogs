import { Elysia } from "elysia";
import { rateLimitHandler } from "../handlers";

export default function registerExampleRoutes(app: Elysia) {
  const globalRateLimit = rateLimitHandler({ maxRequests: 10, windowMs: 60_000 });


  app
    .get("/health", () => ({ status: "ok" }), {
      beforeHandle: globalRateLimit,
    })
    .get("/ping", () => ({ pong: true }), {
      beforeHandle: globalRateLimit,
    });


  return "api";
}
