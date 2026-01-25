# logs-api

Serviço de ingestão e consulta de logs estruturados com isolamento multi-tenant. Cada tenant corresponde a um UniverseId (jogo Roblox) ou identificador numérico de aplicação.

## Arquitetura

Sistema de observabilidade centralizado onde logs são segregados por tenant (UniverseId). O UniverseId nunca é fornecido pelo cliente — é resolvido exclusivamente através da API Key no momento da requisição.

**Stack:**
- **Runtime:** Bun
- **Framework HTTP:** ElysiaJS
- **ORM:** Drizzle ORM
- **Banco de Dados:** PostgreSQL

**Decisões técnicas:**
- **UniverseId como tenant:** Uso de `bigint` nativo do Roblox permite representação direta sem conversões ou mapeamentos
- **API Key para isolamento:** Garante que clientes não possam forjar identidade de tenant ou acessar logs de outros jogos
- **JSONB para metadados:** Suporta payloads heterogêneos sem schema rígido (ex: `place_id`, `server_id`, `job_id`)
- **Alta taxa de escrita:** Índices em `universe_id` e `timestamp` otimizam ingestão e consultas temporais

**Glossário Roblox:**
- **UniverseId:** Identificador do jogo como produto (agrupa múltiplos Places)
- **PlaceId:** Identificador de um Place/experiência específica dentro de um Universe

## Modelo de dados

```
games
  - universe_id (bigint, PK)
  - name
  - created_at

api_keys
  - id (uuid, PK)
  - key (unique, indexed)
  - universe_id (FK -> games.universe_id)
  - created_at

logs
  - id (uuid, PK)
  - universe_id (FK -> games.universe_id, indexed)
  - level (enum: info, warn, error)
  - message (text)
  - metadata (jsonb)
  - timestamp (timestamptz, indexed)
```

O `universe_id` usa `bigint` para compatibilidade direta com o UniverseId do Roblox. Para aplicações não-Roblox, este campo armazena qualquer identificador numérico de aplicação.

## Instalação

```bash
bun install
```

## Execução

```bash
bun run index.ts
```

## API Reference

### Ingestão de log

```http
POST /api/logs
```

**Headers:**
```
X-API-Key: <api_key>
```

**Body:**
```json
{
  "level": "info",
  "message": "User authenticated",
  "timestamp": "2026-01-24T10:30:00Z",
  "metadata": {
    "place_id": 123456789,
    "user_id": 987654321,
    "session_id": "abc-def-ghi"
  }
}
```

**Resposta (201):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "universe_id": 4922741943,
  "timestamp": "2026-01-24T10:30:00Z"
}
```

**Comportamento:**
- O `universe_id` é resolvido através da API Key (cliente não envia)
- Logs segregados por tenant — queries nunca cruzam UniverseIds
- Timestamp pode ser fornecido ou gerado no servidor (UTC)
- Metadados armazenados como JSONB sem validação de schema

### Consulta de logs

```http
GET /api/logs?level=error&from=2026-01-20T00:00:00Z&to=2026-01-24T23:59:59Z
```

**Headers:**
```
X-API-Key: <api_key>
```

**Query Parameters:**
- `level` (opcional): Filtra por nível (`info`, `warn`, `error`)
- `from` (opcional): Timestamp inicial (ISO 8601)
- `to` (opcional): Timestamp final (ISO 8601)
- `limit` (opcional): Número máximo de registros (padrão: 100)

**Resposta (200):**
```json
{
  "logs": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "level": "error",
      "message": "Database connection timeout",
      "metadata": { "timeout_ms": 5000 },
      "timestamp": "2026-01-24T10:30:00Z"
    }
  ],
  "count": 1
}
```

## Segurança

- **Autenticação:** API Key obrigatória em todas as requisições (header `X-API-Key`)
- **Isolamento:** Cada key vincula-se a um único UniverseId — acesso cross-tenant é impossível
- **Provisionamento:** API Keys são geradas administrativamente, sem endpoint público de criação
- **Armazenamento:** Keys devem ser tratadas como secrets e nunca expostas em código cliente

## Escopo

Este é um serviço de infraestrutura para ingestão e consulta de logs. Não inclui:
- UI/dashboard de visualização
- Sistema de alertas ou notificações
- Agregações ou métricas derivadas
- Políticas de retenção ou arquivamento automático
