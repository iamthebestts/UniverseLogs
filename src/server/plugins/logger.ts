import { logger } from "@/core/logger";
import { Elysia } from "elysia";

export const requestLogger = (app: Elysia) =>
  app
    .onRequest((ctx) => {
      ctx.store = { ...ctx.store, requestStartTime: process.hrtime() };
    })
    .onAfterResponse((ctx) => {
      const { request, set, store } = ctx;
      const start = (store as any).requestStartTime;
      
      let duration = 0;
      if (start) {
        const diff = process.hrtime(start);
        duration = (diff[0] * 1e9 + diff[1]) / 1e6; // ms
      }

          const status = typeof set.status === 'string' ? parseInt(set.status, 10) : (set.status ?? 0);
          const method = request.method;
          const url = request.url;
          let path = url;
          try {
              path = new URL(url).pathname;
          } catch {}
      
          const meta = {
            method,
            path,
            status,
            duration: `${duration.toFixed(2)}ms`,
            ip: request.headers.get("x-forwarded-for") || "unknown",
          };
      
          if (status >= 500) {
            logger.error("HTTP Request Failed", meta);
          } else if (status >= 400) {
            logger.warn("HTTP Request Client Error", meta);
          } else {
            logger.info("HTTP Request Completed", meta);
          }    });
