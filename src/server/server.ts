import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { cors } from "@elysiajs/cors";
import { edenTreaty } from "@elysiajs/eden";
import chalk from "chalk";
import { Elysia } from "elysia";
import { logBuffer } from "@/core/log-buffer";
import { logger } from "@/core/logger";
import { sql } from "@/db/client";
import { env } from "@/env";
import { getAuthStrategy } from "./auth/strategies";
import { setupErrorHandling } from "./handlers/error-handler";
import { requestLogger } from "./plugins/logger";
import { securityHeaders } from "./plugins/security";
import { registerRealtime } from "./websocket/realtime.ws";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROUTES_DIR = join(__dirname, "routes");

const isRouteFile = (file: string) => file.endsWith(".route.ts") || file.endsWith(".route.js");

const createApp = () => new Elysia();

export type App = ReturnType<typeof createApp>;

type RouteRegister = (app: App) => void | Elysia;

type RouteOptionsWithAuth = {
  authRequired?: boolean;
  [key: string]: unknown;
};

type RecordedRoute = {
  method: string;
  path: string;
  handlerOrOptions: unknown;
  opts?: RouteOptionsWithAuth;
};

/**
 * Tipo personalizado de manipulador de rota que suporta a opção authRequired e contexto universeId.
 */
type RouteHandler<T = unknown> = (ctx: {
  body: T;
  params: Record<string, string>;
  query: Record<string, string | undefined>;
  request: Request;
  set: { status: number };
  universeId: bigint;
}) => unknown | Promise<unknown>;

type RouteMethod = <T = unknown>(
  path: string,
  handler: RouteHandler<T>,
  options?: RouteOptionsWithAuth,
) => RouteApp;

export type RouteApp = {
  get: RouteMethod;
  post: RouteMethod;
  put: RouteMethod;
  patch: RouteMethod;
  delete: RouteMethod;
  use: (plugin: unknown) => RouteApp;
};

const MAX_HEADER_VALUE_LENGTH = 2048;

const normalizeHeaderValue = (value: string | null): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > MAX_HEADER_VALUE_LENGTH) return undefined;
  for (let i = 0; i < trimmed.length; i += 1) {
    const code = trimmed.charCodeAt(i);
    if (code <= 31 || code === 127) return undefined;
  }
  return trimmed;
};

const loadRoutes = async (app: App) => {
  let files: string[];
  try {
    files = await readdir(ROUTES_DIR);
  } catch {
    console.log(chalk.yellow("[routes] Nenhum diretório de rotas encontrado"));
    return;
  }

  const routeFiles = files.filter(isRouteFile);

  if (routeFiles.length === 0) {
    console.log(chalk.yellow("[routes] Nenhum arquivo .route encontrado"));
  }

  logger.info(`[auth] autenticação global ATIVADA`);

  for (const file of routeFiles) {
    const filePath = join(ROUTES_DIR, file);
    logger.debug(`[routes] carregando ${filePath}`);

    const url = pathToFileURL(filePath).href;
    const mod = await import(url);
    const register = mod.default as RouteRegister | undefined;

    if (typeof register !== "function") {
      logger.warn(`[routes] aviso: ${filePath} não exporta função default`);
      continue;
    }

    const recorded: RecordedRoute[] = [];

    const proxy = {
      get: (p: string, handlerOrOptions: unknown, opts?: RouteOptionsWithAuth) => {
        recorded.push({ method: "GET", path: p, handlerOrOptions, opts });
        return proxy;
      },
      post: (p: string, handlerOrOptions: unknown, opts?: RouteOptionsWithAuth) => {
        recorded.push({ method: "POST", path: p, handlerOrOptions, opts });
        return proxy;
      },
      put: (p: string, handlerOrOptions: unknown, opts?: RouteOptionsWithAuth) => {
        recorded.push({ method: "PUT", path: p, handlerOrOptions, opts });
        return proxy;
      },
      patch: (p: string, handlerOrOptions: unknown, opts?: RouteOptionsWithAuth) => {
        recorded.push({ method: "PATCH", path: p, handlerOrOptions, opts });
        return proxy;
      },
      delete: (p: string, handlerOrOptions: unknown, opts?: RouteOptionsWithAuth) => {
        recorded.push({ method: "DELETE", path: p, handlerOrOptions, opts });
        return proxy;
      },
      use: () => proxy,
    } as any;

    const routeType = (await Promise.resolve(register(proxy))) as "api" | "internal" | undefined;
    const type = routeType === "internal" ? "internal" : "api";
    const prefix = type === "internal" ? "/internal" : "/api";
    const strategy = getAuthStrategy(type);

    const wrapWithAuth = (handler: any, authRequired = true) => {
      if (!authRequired || !strategy) return handler;
      const headerName = strategy.keyHeaderName;

      return async (ctx: any) => {
        const headerValue = normalizeHeaderValue(ctx.request.headers.get(headerName));
        const authHeaders: Record<string, string | string[] | undefined> = {};
        authHeaders[headerName] = headerValue;

        const result = await strategy.validate({ headers: authHeaders, type });
        if (!result.valid) {
          ctx.set.status = 401;
          return { error: result.error ?? "Unauthorized" };
        }
        if (result.universeId !== undefined) (ctx as any).universeId = result.universeId;
        return handler(ctx);
      };
    };

    const normalizeRoute = (handlerOrOptions: unknown, opts?: RouteOptionsWithAuth) => {
      if (
        handlerOrOptions &&
        typeof handlerOrOptions === "object" &&
        "handler" in handlerOrOptions
      ) {
        const options = handlerOrOptions as RouteOptionsWithAuth & { handler?: unknown };
        return {
          isObjectStyle: true,
          handler: options.handler,
          options,
          authRequired: options.authRequired,
        };
      }
      return {
        isObjectStyle: false,
        handler: handlerOrOptions,
        options: opts,
        authRequired: opts?.authRequired,
      };
    };

    for (const r of recorded) {
      const fullPath = r.path.startsWith(prefix) ? r.path : `${prefix}${r.path}`;
      const method = r.method.toLowerCase();
      const normalized = normalizeRoute(r.handlerOrOptions, r.opts);
      if (typeof normalized.handler !== "function") continue;

      const authRequired = normalized.authRequired !== false;
      const wrappedHandler = wrapWithAuth(normalized.handler, authRequired);

      const options =
        normalized.isObjectStyle && normalized.options
          ? { ...normalized.options }
          : { ...normalized.options };
      if ("authRequired" in options) delete (options as any).authRequired;
      if ("handler" in options) delete (options as any).handler;

      (app as any)[method](fullPath, wrappedHandler, options);
      logger.info(`[route] ${r.method} ${fullPath} (${type}) auth:${authRequired ? "on" : "off"}`);
    }
  }
};

const serviceMetaPlugin = (app: App) =>
  app.state("service", {
    name: "logs-api",
    version: process.env.npm_package_version ?? "dev",
  });

export const buildApp = async () => {
  const app = createApp();
  app.use(requestLogger);
  app.use(cors());
  app.use(securityHeaders);

  if (env.NODE_ENV !== "test") {
    const { websocket } = await import("@elysiajs/websocket");
    const { swagger } = await import("@elysiajs/swagger");
    app.use(websocket());
    app.use(
      swagger({
        path: "/docs",
        documentation: {
          info: {
            title: "Logs API",
            version: process.env.npm_package_version ?? "dev",
            description: "API multi-tenant.",
          },
          components: {
            securitySchemes: {
              ApiKeyAuth: { type: "apiKey", name: "x-api-key", in: "header" },
              MasterKeyAuth: { type: "apiKey", name: "x-master-key", in: "header" },
            },
          },
        },
      }),
    );
  }

  app.use(serviceMetaPlugin);
  setupErrorHandling(app);
  await loadRoutes(app);

  if (env.NODE_ENV !== "test") registerRealtime(app);
  return app;
};

export const startServer = async () => {
  const app = await buildApp();
  const { PORT: port, HOST: hostname } = env;
  const server = app.listen({ port, hostname }, () => {
    logger.info(`[server] HTTP server listening on ${hostname}:${port}`);
  });
  const shutdown = async () => {
    logger.warn("[server] Shutting down...");
    await logBuffer.stop();
    await sql.end({ timeout: 5 });
    await server.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  return app;
};

export const createEdenClient = (baseUrl: string) => edenTreaty<App>(baseUrl);
