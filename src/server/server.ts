import { env } from "@/env";
import { edenTreaty } from "@elysiajs/eden";
import chalk from "chalk";
import { Elysia } from "elysia";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { getAuthStrategy } from "./auth/strategies";
import type { AuthResult } from "./auth/types";
import { setupErrorHandling } from "./handlers/error-handler";

import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROUTES_DIR = join(__dirname, "routes");

const isRouteFile = (file: string) =>
  file.endsWith(".route.ts") || file.endsWith(".route.js");

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
 * Custom route handler type that supports authRequired option and universeId context.
 * This is the type used by the route proxy, not the real Elysia app.
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
  options?: RouteOptionsWithAuth
) => RouteApp;

/**
 * Type representing the route registration proxy.
 * Route files receive this proxy (not the real Elysia app) which supports authRequired.
 */
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

  const authEnabled = env.USE_AUTH === true;
  console.log(
    chalk.blue(`[auth] autenticação global ${authEnabled ? "ATIVADA" : "DESATIVADA"}`)
  );

  for (const file of routeFiles) {
    const filePath = join(ROUTES_DIR, file);
    console.log(chalk.blue(`[routes] carregando ${filePath}`));

    const url = pathToFileURL(filePath).href;
    const mod = await import(url);
    const register = mod.default as RouteRegister | undefined;

    if (typeof register !== "function") {
      console.log(chalk.yellow(`[routes] aviso: ${filePath} não exporta função default`));
      continue;
    }
    // Record registrations made by the module on a proxy
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

    const routeType = (await Promise.resolve(register(proxy))) as ("api" | "internal" | undefined);

    const type = routeType === "internal" ? "internal" : "api";

    const prefix = type === "internal" ? "/internal" : "/api";

    const strategy = authEnabled ? getAuthStrategy(type) : undefined;

    const wrapWithAuth = (handler: any, authRequired = true) => {
      if (!authEnabled || !authRequired) {
        return handler;
      }

      if (!strategy) {
        return handler;
      }

      const headerName = strategy.keyHeaderName;

      return (ctx: any) => {
        const headerValue = normalizeHeaderValue(
          ctx.request.headers.get(headerName)
        );

        const headers: Record<string, string | string[] | undefined> = {
          [headerName]: headerValue,
        };

        const result = strategy.validate({ headers, type });
        const handleUnauthorized = (error?: string) => {
          ctx.set.status = 401;
          return { error: error ?? "Unauthorized" };
        };

        const isPromise = (value: unknown): value is Promise<AuthResult> =>
          typeof (value as Promise<AuthResult>)?.then === "function";

        if (isPromise(result)) {
          return result.then((authResult) => {
            if (!authResult.valid) {
              return handleUnauthorized(authResult.error);
            }
            if (authResult.universeId) {
              (ctx as any).universeId = authResult.universeId;
            }
            return handler(ctx);
          });
        }

        if (!result.valid) {
          return handleUnauthorized(result.error);
        }

        if (result.universeId) {
          (ctx as any).universeId = result.universeId;
        }

        return handler(ctx);
      };
    };

    const normalizeRoute = (
      handlerOrOptions: unknown,
      opts?: RouteOptionsWithAuth
    ) => {
      if (handlerOrOptions && typeof handlerOrOptions === "object" && "handler" in handlerOrOptions) {
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
      if (typeof normalized.handler !== "function") {
        console.log(
          chalk.yellow(`[routes] aviso: handler inválido em ${fullPath} (${type})`)
        );
        continue;
      }

      const authRequired = normalized.authRequired !== false;
      const wrappedHandler = wrapWithAuth(normalized.handler, authRequired);

      if (normalized.isObjectStyle && normalized.options) {
        const { authRequired: _authRequired, handler: _handler, ...options } = normalized.options as RouteOptionsWithAuth & { handler?: unknown };
        (app as any)[method](fullPath, wrappedHandler, options);
      } else {
        const options = normalized.options && typeof normalized.options === "object"
          ? { ...normalized.options }
          : normalized.options;
        if (options && typeof options === "object" && "authRequired" in options) {
          delete (options as RouteOptionsWithAuth).authRequired;
        }
        (app as any)[method](fullPath, wrappedHandler, options);
      }

      console.log(
        chalk.green(
          `[route] ${r.method} ${fullPath} (${type}) auth:${!authEnabled ? "off" : authRequired ? "on" : "off"}`
        )
      );
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

  app.use(serviceMetaPlugin);
  setupErrorHandling(app);

  await loadRoutes(app);

  if (((app as any).routes ?? []).length === 0) {
    console.log(chalk.yellow("[routes] Nenhuma rota registrada — endpoints retornarão 404"));
  }

  return app;
};

export const startServer = async () => {
  const app = await buildApp();

  const { PORT: port, HOST: hostname } = env;
  app.listen({ port, hostname }, () => {
    console.log(chalk.green(`[server] HTTP server listening on ${hostname}:${port}`));
  });

  return app;
};

export const createEdenClient = (baseUrl: string) =>
  edenTreaty<App>(baseUrl);