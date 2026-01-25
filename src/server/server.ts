import { getAuthStrategy } from "./auth/strategies";
import { edenTreaty } from "@elysiajs/eden";
import chalk from "chalk";
import { Elysia } from "elysia";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ROUTES_DIR = join(import.meta.dir, "routes");

const isRouteFile = (file: string) =>
  file.endsWith(".route.ts") || file.endsWith(".route.js");

const createApp = () => new Elysia();

export type App = ReturnType<typeof createApp>;

type RouteRegister = (app: App) => void | Elysia;

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
    const recorded: Array<{ method: string; path: string; handler: any; opts?: any }> = [];

    const proxy = {
      get: (p: string, h: any, opts?: any) => {
        recorded.push({ method: "GET", path: p, handler: h, opts });
        return proxy;
      },
      post: (p: string, h: any, opts?: any) => {
        recorded.push({ method: "POST", path: p, handler: h, opts });
        return proxy;
      },
      put: (p: string, h: any, opts?: any) => {
        recorded.push({ method: "PUT", path: p, handler: h, opts });
        return proxy;
      },
      patch: (p: string, h: any, opts?: any) => {
        recorded.push({ method: "PATCH", path: p, handler: h, opts });
        return proxy;
      },
      delete: (p: string, h: any, opts?: any) => {
        recorded.push({ method: "DELETE", path: p, handler: h, opts });
        return proxy;
      },
      use: () => proxy,
    } as any;

    const routeType = (await Promise.resolve(register(proxy))) as ("api" | "internal" | undefined);

    const type = routeType === "internal" ? "internal" : "api";

    const prefix = type === "internal" ? "/internal" : "/api";

    const strategy = getAuthStrategy(type);

    const wrapWithAuth = (handler: any) => {
      return async (ctx: any) => {
        // Extract headers from Elysia context
        const headers: Record<string, string | string[] | undefined> = {};
        ctx.request.headers.forEach((value: string, key: string) => {
          headers[key.toLowerCase()] = value;
        });

        const result = await strategy.validate({ headers, type });
        if (!result.valid) {
          return { status: 401, error: result.error };
        }

        return handler(ctx);
      };
    };

    for (const r of recorded) {
      const fullPath = r.path.startsWith(prefix) ? r.path : `${prefix}${r.path}`;

      const method = r.method.toLowerCase();
      (app as any)[method](fullPath, wrapWithAuth(r.handler), r.opts);
      console.log(chalk.green(`[route] ${r.method} ${fullPath} (${type})`));
    }
  }
};

const serviceMetaPlugin = (app: App) =>
  app.state("service", {
    name: "logs-api",
    version: process.env.npm_package_version ?? "dev",
  });

export const startServer = async () => {
  const app = createApp();

  app.use(serviceMetaPlugin);

  await loadRoutes(app);

  if (((app as any).routes ?? []).length === 0) {
    console.log(chalk.yellow("[routes] Nenhuma rota registrada — endpoints retornarão 404"));
  }

  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, () => {
    console.log(chalk.green(`[server] HTTP server listening on :${port}`));
  });

  return app;
};

export const createEdenClient = (baseUrl: string) =>
  edenTreaty<App>(baseUrl);