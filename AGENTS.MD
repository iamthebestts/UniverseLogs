# AGENTS.MD

## 1. Visão Geral do Projeto
**Nome:** `logs-api`
**Descrição:** Serviço de ingestão e consulta de logs estruturados com isolamento multi-tenant. O sistema é focado em alta performance para atender jogos Roblox (identificados por UniverseId) e outras aplicações distribuídas.
**Objetivo Principal:** Centralizar observabilidade garantindo segurança por isolamento (via API Keys) e flexibilidade de esquema (via JSONB).

---

## 2. Stack Tecnológica
- **Runtime:** Bun (Performance e DX)
- **Linguagem:** TypeScript
- **Framework HTTP:** ElysiaJS (Alta performance, Type-safety)
- **Banco de Dados:** PostgreSQL
- **ORM:** Drizzle ORM
- **Testes:** Vitest + @vitest/ui + @vitest/coverage-v8
- **Validação:** Zod / TypeBox (via Elysia `t`)

---

## 3. Estrutura e Padrões de Código

### 3.1 Organização de Diretórios
```
src/
├── core/           # Lógica central e tipos básicos
├── db/             # Configuração do Drizzle e Schemas
│   └── schema.ts   # Definição das tabelas
├── services/       # Lógica de negócio (Desacoplada do HTTP)
└── server/         # Camada HTTP (Elysia)
    ├── routes/     # Definição de endpoints (.route.ts)
    ├── handlers/   # Middlewares e utilitários (Rate Limit, Error Handler)
    ├── auth/       # Estratégias de autenticação
    └── server.ts   # Entrypoint do servidor e registro dinâmico
```

### 3.2 Criação e Registro de Rotas (Padrão Proxy)
O projeto usa um sistema de carregamento dinâmico de rotas em `src/server/server.ts`.
**Como funciona:**
1. Crie um arquivo em `src/server/routes/` com sufixo `.route.ts`.
2. Exporte uma função `default` que recebe `app`.
3. Retorne `"api"` (para prefixo `/api`) ou `"internal"` (para prefixo `/internal`).

**Exemplo:**
```typescript
import { t } from "elysia";
export default function registerMyRoute(app: Elysia) {
  app.get("/hello", () => ({ hello: "world" }), {
    // Opção customizada processada pelo loader
    authRequired: true 
  });
  
  return "api"; // Gera rota: GET /api/hello
}
```
**Importante:** O `app` passado é um Proxy que intercepta as definições para aplicar autenticação automática e prefixos.

### 3.3 Handlers e Services
- **Services (`src/services`):** Contêm a regra de negócio e chamadas ao banco. Devem ser agnósticos ao framework HTTP.
- **Routes (`src/server/routes`):** Lidam com parsing de requisição, validação (usando `t` do Elysia) e chamam os services.

---

## 4. Banco de Dados (Drizzle ORM)

### 4.1 Schema (`src/db/schema.ts`)
- **`games`**: Catálogo de tenants.
  - `universe_id` (PK, bigint): ID do jogo Roblox.
- **`api_keys`**: Credenciais de acesso.
  - `key`: Chave única.
  - `universe_id`: Vincula a chave a um único tenant.
- **`logs`**: Dados de observabilidade.
  - `universe_id`: Chave de particionamento lógico.
  - `metadata` (jsonb): Flexibilidade para campos extras (`place_id`, `job_id`).
  - Índices em `universe_id` e `timestamp`.

### 4.2 Diretrizes de Uso
- Sempre use `bigint` para `universe_id` e `place_id` (compatibilidade Roblox).
- Para consultas de logs, **SEMPRE** filtre por `universe_id` primeiro.

---

## 5. Autenticação e Segurança
- **Estratégia:** API Key no header (ex: `X-API-Key` ou customizável).
- **Fluxo:**
  1. O middleware global (`server.ts`) intercepta rotas com `authRequired: true`.
  2. Valida a chave no banco.
  3. Se válida, o contexto da rota não recebe o tenant explicitamente, mas o service pode re-validar ou obter o ID se necessário (verifique `src/services/api-keys.service.ts`).
- **Isolamento:** O cliente nunca envia o `universe_id`. O sistema deduz quem é o tenant pela chave.

---

## 6. Estado Atual e Qualidade (v1.0.50)
- **Status dos Testes:** ✅ Production Ready (100% Pass Rate).
- **Cobertura:** Suite robusta cobrindo `Rate Limit`, `Error Handler` e `Services`.

---

# AGENTS.MD

## 1. Visão Geral do Projeto
**Nome:** `logs-api`
**Descrição:** Serviço de ingestão e consulta de logs estruturados com isolamento multi-tenant. O sistema é focado em alta performance para atender jogos Roblox (identificados por UniverseId) e outras aplicações distribuídas.
**Objetivo Principal:** Centralizar observabilidade garantindo segurança por isolamento (via API Keys) e flexibilidade de esquema (via JSONB).

---

## 2. Stack Tecnológica
- **Runtime:** Bun (Performance e DX)
- **Linguagem:** TypeScript
- **Framework HTTP:** ElysiaJS (Alta performance, Type-safety)
- **Banco de Dados:** PostgreSQL
- **ORM:** Drizzle ORM
- **Testes:** Vitest + @vitest/ui + @vitest/coverage-v8
- **Validação:** Zod / TypeBox (via Elysia `t`)

---

## 3. Estrutura e Padrões de Código

### 3.1 Organização de Diretórios
```
src/
├── core/           # Lógica central e tipos básicos
├── db/             # Configuração do Drizzle e Schemas
│   └── schema.ts   # Definição das tabelas
├── services/       # Lógica de negócio (Desacoplada do HTTP)
└── server/         # Camada HTTP (Elysia)
    ├── routes/     # Definição de endpoints (.route.ts)
    ├── handlers/   # Middlewares e utilitários (Rate Limit, Error Handler)
    ├── auth/       # Estratégias de autenticação
    └── server.ts   # Entrypoint do servidor e registro dinâmico
```

### 3.2 Criação e Registro de Rotas (Padrão Proxy)
O projeto usa um sistema de carregamento dinâmico de rotas em `src/server/server.ts`.
**Como funciona:**
1. Crie um arquivo em `src/server/routes/` com sufixo `.route.ts`.
2. Exporte uma função `default` que recebe `app`.
3. Retorne `"api"` (para prefixo `/api`) ou `"internal"` (para prefixo `/internal`).

**Exemplo:**
```typescript
import { t } from "elysia";
export default function registerMyRoute(app: Elysia) {
  app.get("/hello", () => ({ hello: "world" }), {
    // Opção customizada processada pelo loader
    authRequired: true 
  });
  
  return "api"; // Gera rota: GET /api/hello
}
```
**Importante:** O `app` passado é um Proxy que intercepta as definições para aplicar autenticação automática e prefixos.

### 3.3 Handlers e Services
- **Services (`src/services`):** Contêm a regra de negócio e chamadas ao banco. Devem ser agnósticos ao framework HTTP.
- **Routes (`src/server/routes`):** Lidam com parsing de requisição, validação (usando `t` do Elysia) e chamam os services.

---

## 4. Banco de Dados (Drizzle ORM)

### 4.1 Schema (`src/db/schema.ts`)
- **`games`**: Catálogo de tenants.
  - `universe_id` (PK, bigint): ID do jogo Roblox.
- **`api_keys`**: Credenciais de acesso.
  - `key`: Chave única.
  - `universe_id`: Vincula a chave a um único tenant.
- **`logs`**: Dados de observabilidade.
  - `universe_id`: Chave de particionamento lógico.
  - `metadata` (jsonb): Flexibilidade para campos extras (`place_id`, `job_id`).
  - Índices em `universe_id` e `timestamp`.

### 4.2 Diretrizes de Uso
- Sempre use `bigint` para `universe_id` e `place_id` (compatibilidade Roblox).
- Para consultas de logs, **SEMPRE** filtre por `universe_id` primeiro.

---

## 5. Autenticação e Segurança
- **Estratégia:** API Key no header (ex: `X-API-Key` ou customizável).
- **Fluxo:**
  1. O middleware global (`server.ts`) intercepta rotas com `authRequired: true`.
  2. Valida a chave no banco.
  3. Se válida, o contexto da rota não recebe o tenant explicitamente, mas o service pode re-validar ou obter o ID se necessário (verifique `src/services/api-keys.service.ts`).
- **Isolamento:** O cliente nunca envia o `universe_id`. O sistema deduz quem é o tenant pela chave.

---

## 6. Estado Atual e Qualidade (v1.0.50)
- **Status dos Testes:** ✅ Production Ready (100% Pass Rate).
- **Cobertura:** Suite robusta cobrindo `Rate Limit`, `Error Handler` e `Services`.

---

## 7. Diretrizes para a IA (Você)
1.  **Segurança em Primeiro Lugar:**
    - Nunca exponha chaves ou segredos.
    - Garanta isolamento de tenant em todas as queries.

2.  **Padrões de Código:**
    - Use **Bun** para scripts.
    - Ao criar rotas, siga o padrão de exportação `default` e use validação do Elysia (`t`).
    - Separe lógica: Rota trata HTTP, Service trata Negócio.

3.  **Contexto Roblox:**
    - `UniverseId` é um `bigint`. Não use `uuid` ou `int` para ele.
    - Diferencie limites por endpoint e por chave de API, evitando colisões de contadores.
    - Sempre registre hits e bloqueios (para monitoramento e debug).
    - Use cache em memória (`MemoryCache`) com TTL e limpeza automática.

4. **Error Handling**
  - Todas as rotas e middlewares devem propagar erros de forma consistente.
  - Crie um `ErrorHandler` global que capture erros não tratados, registre logs e retorne respostas padronizadas.
  - Não exponha stack traces ou detalhes internos em produção.

5. **Boas Práticas de Código**
  - Separe responsabilidades: Routes → HTTP / Services → Business Logic.
  - Use validação de schemas (`t` do Elysia ou Zod/TypeBox) antes de chamar services.
  - Mantenha tipagem consistente, especialmente para `bigint` e IDs de Roblox.
  - Sempre use constantes ou env para configurações (ex: `env.PORT`, `env.USE_AUTH`).

6. **Banco de Dados e Queries**
  - Sempre filtre por `universe_id` primeiro.
  - Use `bigint` para IDs de jogos e lugares.
  - Evite construir queries dinâmicas sem escapar entradas (prevenir SQL Injection).

7. **Expectativas de Comportamento da IA**
  - Sugira melhorias de performance, segurança e manutenção de forma proativa.
  - Refatore handlers (Auth, Rate Limit, Error) para consistência e reutilização.
  - Mantenha compatibilidade com Bun, ElysiaJS e Drizzle ORM.
  - Não invente endpoints fora do escopo ou dados fictícios de tenants.
  - Forneça exemplos e snippets apenas quando necessário para clareza.

8. **Controle de Deploy e Configuração**
  - Variáveis críticas: `USE_AUTH`, `MASTER_KEY`, `PORT`, limites de Rate Limit.
  - Qualquer alteração de autenticação ou rate limit deve ser centralizada.
  - Garanta que mudanças possam ser revertidas facilmente (rollback seguro).

9. **Boas Práticas de Commit**
  - Mensagens claras e padronizadas (ex: `feat: adiciona rate limit global`, `fix: corrige validação de API Key`).
  - Relacione commits com issues ou tickets quando possível.
  - Não quebre autenticação, rate limit ou esquema do banco sem testes.

10. **Monitoramento e Logs**
  - Sempre registre eventos importantes (hits, blocks, erros).
  - Use logs estruturados para facilitar consultas e debug.
  - Não logue chaves ou informações sensíveis em texto puro.