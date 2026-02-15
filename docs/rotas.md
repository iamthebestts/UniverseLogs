# Rotas da API

Referência das rotas definidas em `src/server/routes/`. O prefixo é aplicado conforme o tipo: **api** → `/api`, **internal** → `/internal`.

## Autenticação

| Tipo     | Header        | Uso                    |
|----------|---------------|------------------------|
| API      | `X-API-Key`   | Rotas `/api/*` (por tenant) |
| Internal | `X-Master-Key`| Rotas `/internal/*` (admin) |

Rotas com `authRequired: false` não exigem header.

---

## health.route.ts (API)

Base: `/api`

| Método | Caminho   | Auth   | Descrição |
|--------|-----------|--------|-----------|
| GET    | `/health` | Não    | Health check com verificação do banco |
| GET    | `/ping`   | Não    | Liveness simples |

### GET /api/health

- **Resposta 200:** `{ status, timestamp, version, checks: { database, databaseLatencyMs? } }`
- **Resposta 503:** Banco indisponível — `{ status: "unavailable", timestamp, version, checks: { database: "disconnected" } }`

### GET /api/ping

- **Resposta 200:** `{ pong: true, timestamp }`

---

## logs.route.ts (API)

Base: `/api`. Todas exigem `X-API-Key`; o `universe_id` é resolvido pela chave.

| Método | Caminho     | Auth | Descrição |
|--------|-------------|------|-----------|
| POST   | `/logs`     | Sim  | Criar log |
| GET    | `/logs/:id` | Sim  | Buscar log por ID (do tenant) |

### POST /api/logs

**Body (JSON):**

| Campo    | Tipo   | Obrigatório | Descrição |
|----------|--------|-------------|-----------|
| level    | string | Sim         | `info` \| `warn` \| `error` |
| message  | string | Sim         | Até 2048 caracteres |
| metadata | any    | Não         | Objeto livre (JSONB) |
| topic    | string | Não         | Até 100 caracteres |

**Resposta 201:** objeto do log serializado (id, universe_id, level, message, metadata, topic, timestamp).

### GET /api/logs/:id

- **Resposta 200:** objeto do log.
- **Resposta 404:** log não encontrado ou de outro tenant.

---

## universes.route.ts (API)

Base: `/api`. Todas exigem `X-API-Key`.

| Método | Caminho              | Auth | Descrição |
|--------|----------------------|------|-----------|
| POST   | `/universes`         | Sim  | Criar universo e opcionalmente API key |
| GET    | `/universes/:id`     | Sim  | Dados do universo + últimos logs |
| POST   | `/universes/:id/revoke` | Sim | Revogar universo |

### POST /api/universes

**Body (JSON):**

| Campo       | Tipo    | Obrigatório | Descrição |
|-------------|---------|-------------|-----------|
| universeId  | number \| string | Sim | ID do universo (Roblox ou numérico) |
| name        | string  | Não         | Nome do universo |
| description | string  | Não         | Descrição |
| createKey   | boolean | Não         | Se `false`, não cria API key (default: true) |

**Resposta 200:** `{ universe, key? }` (serializado).

### GET /api/universes/:id

- **Resposta 200:** `{ universe, logs }` (até 10 últimos logs). `null` se universo não existir.

### POST /api/universes/:id/revoke

- **Resposta 200:** `{ success: true }`.

---

## api-keys.route.ts (Internal)

Base: `/internal`. Todas exigem `X-Master-Key`.

| Método | Caminho           | Descrição |
|--------|-------------------|-----------|
| POST   | `/keys/register`  | Registrar nova API key para um universo |
| POST   | `/keys/revoke`    | Revogar API key |
| GET    | `/keys/validate`  | Validar API key (query) |
| GET    | `/keys/list`      | Listar keys (opcional por universeId) |
| GET    | `/keys/count`     | Contar keys ativas |

### POST /internal/keys/register

**Body (JSON):** `{ universeId: number | string }`

**Resposta 200:** `{ key }` (nova API key).

### POST /internal/keys/revoke

**Body (JSON):** `{ key: string }`

**Resposta 200:** `{ success: true }`.  
**Erro:** chave inválida.

### GET /internal/keys/validate

**Query:** `key` (string)

**Resposta 200:** `{ valid: true, universeId }`.

### GET /internal/keys/list

**Query:** `universeId` (opcional, number ou string)

**Resposta 200:** lista de keys (serializada).

### GET /internal/keys/count

**Resposta 200:** `{ count: number }`.

---

## universes.internal.route.ts (Internal)

Base: `/internal`. Exige `X-Master-Key`.

| Método | Caminho             | Descrição |
|--------|---------------------|-----------|
| POST   | `/universes/create` | Criar universo (sem key) |

### POST /internal/universes/create

**Body (JSON):** `{ universeId: number | string }`

**Resposta 200:** objeto do universo criado.
