# AGENTS.MD

## 1. Visão Geral do Projeto
**Nome:** `UniverseLogs`
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

## 7. Regras de Desenvolvimento (Diretrizes para a IA)

### 7.1 Segurança
- **Nunca** exponha chaves, `MASTER_KEY` ou segredos em código, logs ou respostas.
- **Isolamento de tenant:** Todas as queries que tocam dados de tenant devem filtrar por `universe_id` (resolvido via API Key). O cliente nunca envia `universe_id`.
- Não exponha stack traces ou detalhes internos em produção; use um ErrorHandler global com respostas padronizadas.

### 7.2 Padrões de Código
- **Runtime/scripts:** Use **Bun** (não Node para scripts do projeto).
- **Rotas:** Arquivo `*.route.ts` em `src/server/routes/`, export `default(app)`, retorne `"api"` ou `"internal"`. Use validação Elysia (`t`) em todo body/query/params.
- **Separação:** Route = HTTP (parsing, validação, resposta); Service = lógica de negócio e acesso ao banco. Services não dependem de Elysia.
- **Configuração:** Sempre use `env` ou constantes (ex: `env.PORT`, `env.USE_AUTH`); nada hardcoded sensível ou variável por ambiente.
- **Tipos:** `universe_id` e `place_id` são `bigint` (compatibilidade Roblox). Mantenha tipagem consistente.

### 7.3 Banco de Dados
- **Queries:** Sempre filtrar por `universe_id` primeiro; usar `bigint` para IDs de jogos/lugares.
- **Segurança:** Evitar queries dinâmicas com concatenação de entrada (prevenir SQL Injection); preferir Drizzle/parâmetros.
- **Migrações:** Alterações de schema via Drizzle; documentar em `docs/deploy.md` quem roda migrações em cada ambiente.

### 7.4 Testes e Qualidade
- Antes de considerar uma alteração concluída: rodar `bun run check` e `bun run type-check`; testes unitários e, se aplicável, E2E.
- Não quebrar autenticação, rate limit ou esquema do banco sem testes que cubram o fluxo.
- Novos endpoints ou mudanças de contrato: atualizar ou adicionar testes e, se relevante, `docs/rotas.md`.

### 7.5 Documentação e Deploy
- **Rotas:** Novas rotas ou mudanças de contrato devem ser refletidas em `docs/rotas.md`. WebSocket em `docs/websocket.md`, operações em `docs/operations.md`.
- **Deploy:** Variáveis críticas (`USE_AUTH`, `MASTER_KEY`, `PORT`, rate limits) centralizadas; alterações que afetem deploy documentadas. Garantir rollback seguro (sem migrações destrutivas sem plano).
- **Commits:** Mensagens claras e convencionais (ex: `feat: ...`, `fix: ...`); relacionar a issues quando possível.

### 7.6 Comportamento da IA
- Manter compatibilidade com Bun, ElysiaJS e Drizzle ORM.
- Não inventar endpoints, tenants ou dados fictícios fora do escopo.
- Sugerir melhorias de performance, segurança e manutenção quando relevante; refatorar handlers para consistência e reuso.
- Fornecer exemplos/snippets apenas quando melhorar clareza (ex: novo endpoint ou fluxo).
- Ao alterar estrutura do projeto ou convenções, atualizar este AGENTS.MD para refletir as regras atuais.