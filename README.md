# logs-api

API de ingestão e consulta de logs estruturados com isolamento multi-tenant. Cada tenant é identificado por um UniverseId (jogo Roblox) ou por um ID numérico de aplicação. O tenant é sempre resolvido pela API Key — o cliente não envia UniverseId nas requisições.

## Stack

| Camada        | Tecnologia   |
|---------------|--------------|
| Runtime       | [Bun](https://bun.sh) |
| HTTP          | [Elysia](https://elysiajs.com) |
| Banco de dados| PostgreSQL + [Drizzle ORM](https://orm.drizzle.team) |
| Validação     | Zod (env + body/query) |

## Pré-requisitos

- [Bun](https://bun.sh) instalado
- PostgreSQL em execução

## Como rodar

1. **Clonar e instalar**

   ```bash
   git clone https://github.com/iamthebestts/logs-api
   cd logs-api
   bun install
   ```

2. **Variáveis de ambiente**

   Copie o exemplo e preencha os valores obrigatórios:

   ```bash
   cp .env.example .env
   ```

   Campos obrigatórios: `DATABASE_URL`, `MASTER_KEY`. O restante tem valor padrão (veja `.env.example`).

3. **Migrações** — Por padrão a aplicação aplica as migrações ao subir (`RUN_MIGRATE=true`). Para rodar só via CLI antes de iniciar: `bun run migrate`. Ver **quem roda as migrações no deploy** em [docs/deploy.md](docs/deploy.md).

4. **Subir a API**

   ```bash
   bun run dev    # desenvolvimento (watch)
   bun run start  # produção
   ```

   Por padrão o servidor escuta em `http://localhost:3000`.

## Scripts

| Comando           | Uso |
|-------------------|-----|
| `bun run dev`     | Desenvolvimento com reload |
| `bun run start`   | Produção |
| `bun run migrate` | Aplicar migrações (Drizzle); na subida da API já roda se `RUN_MIGRATE=true` |
| `bun test`       | Testes (Vitest) |

## Documentação da API

Referência completa das rotas (métodos, body, query, autenticação):

- **[docs/rotas.md](docs/rotas.md)** — Todas as rotas em `src/server/routes/`

Resumo rápido:

- **Autenticação:** rotas `/api/*` usam header `X-API-Key`; rotas `/internal/*` usam `X-Master-Key`. `/api/health` e `/api/ping` são públicas.
- **Principais endpoints:** `POST /api/logs` (criar log), `GET /api/logs/:id` (buscar log), além de gestão de universos e API keys (detalhes em `docs/rotas.md`).

## Docker e Discloud

### Docker

O projeto inclui um `Dockerfile` para rodar a API em container (Bun, porta 8080):

```bash
docker build -t logs-api .
docker run -p 8080:8080 --env-file .env logs-api
```

No container, `PORT=8080` e `HOST=0.0.0.0` já vêm definidos; para produção defina `DATABASE_URL`, `MASTER_KEY` e demais variáveis (via `--env-file` ou `-e`).

### Discloud

Para deploy na [Discloud](https://discloud.com) como **site/API**:

1. **Subdomínio** — No dashboard Discloud, crie um subdomínio (ex.: `logs-api` → `logs-api.discloud.app`).
2. **Arquivo `discloud.config`** — Já está na raiz do projeto. Ajuste `ID` para o subdomínio criado.
3. **Variáveis de ambiente** — No dashboard da aplicação, configure pelo menos:
   - `PORT=8080`
   - `HOST=0.0.0.0`
   - `DATABASE_URL`
   - `MASTER_KEY`
   - Demais variáveis conforme `.env.example`.
4. **Deploy** — Envie o projeto em zip (pelo site, CLI, Bot Discord ou [extensão VS Code](https://marketplace.visualstudio.com/items?itemName=Discloud.discloud)); o arquivo `discloud.config` deve estar na raiz do zip. Use `.discloudignore` para não enviar pastas desnecessárias.

Requisitos Discloud para sites: plano Platinum ou superior, RAM mínima 512 MB. A aplicação escuta em `0.0.0.0:8080` quando `PORT=8080` e `HOST=0.0.0.0`. **Migrações:** por padrão a própria app roda as migrações na subida; detalhes em [docs/deploy.md](docs/deploy.md).

## Estrutura do projeto

```
src/
  server/          # app Elysia, auth, handlers
    routes/        # definição das rotas (api + internal)
  services/        # lógica de negócio (logs, universes, api-keys)
  db/              # schema Drizzle e cliente Postgres
  core/            # validação de env, cache, etc.
docs/              # documentação (rotas)
```

## Testes

```bash
bun test
bun run test:coverage  # relatório de cobertura
```

Testes com Vitest; mocks para env e serviços externos.
