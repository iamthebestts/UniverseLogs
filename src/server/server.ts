import { edenTreaty } from "@elysiajs/eden";
import chalk from "chalk";
import { Elysia } from "elysia";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ROUTES_DIR = join(import.meta.dir, "routes");

const isRouteFile = (file: string) =>
  file.endsWith(".route.ts") || file.endsWith(".route.js");

const createApp = () => new Elysia({ prefix: "/api" });

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

    const before = (app as any).routes?.length ?? 0;
    register(app);
    const afterRoutes = ((app as any).routes ?? []) as any[];

    for (let i = before; i < afterRoutes.length; i += 1) {
      const r: any = afterRoutes[i];
      const prefix = (app as any).config?.prefix ?? "";
      const path = (r.path ?? "").toString();
      const methodRaw = r.method ?? r.methods ?? "";
      const method = String(methodRaw).toUpperCase();

      let fullPath = path.startsWith(prefix) ? path : `${prefix}${path}`;

      if (prefix && fullPath.startsWith(prefix + prefix)) {
        fullPath = fullPath.replace(prefix + prefix, prefix);
      }

      console.log(chalk.green(`[route] ${method} ${fullPath}`));
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