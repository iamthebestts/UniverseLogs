import { Elysia } from "elysia";

export const securityHeaders = (app: Elysia) =>
  app.onRequest(({ set }) => {
    set.headers["X-DNS-Prefetch-Control"] = "off";
    set.headers["X-Frame-Options"] = "SAMEORIGIN";
    set.headers["Strict-Transport-Security"] = "max-age=15552000; includeSubDomains";
    set.headers["X-Download-Options"] = "noopen";
    set.headers["X-Content-Type-Options"] = "nosniff";
    set.headers["Referrer-Policy"] = "no-referrer";
    set.headers["X-Permitted-Cross-Domain-Policies"] = "none";
  });
