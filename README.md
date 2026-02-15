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

3. **Migrações**

   ```bash
   bun run migrate
   ```

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
| `bun run migrate` | Aplicar migrações (Drizzle) |
| `bun test`       | Testes (Vitest) |

## Documentação da API

Referência completa das rotas (métodos, body, query, autenticação):

- **[docs/rotas.md](docs/rotas.md)** — Todas as rotas em `src/server/routes/`

Resumo rápido:

- **Autenticação:** rotas `/api/*` usam header `X-API-Key`; rotas `/internal/*` usam `X-Master-Key`. `/api/health` e `/api/ping` são públicas.
- **Principais endpoints:** `POST /api/logs` (criar log), `GET /api/logs/:id` (buscar log), além de gestão de universos e API keys (detalhes em `docs/rotas.md`).

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
