# Deploy e migrações

## Quem roda as migrações no deploy

**Por padrão, a própria aplicação roda as migrações na subida do processo.**

- **Quando:** Antes de abrir a porta HTTP, na ordem: carregar env → (se `RUN_MIGRATE=true`) aplicar migrações Drizzle → iniciar servidor.
- **Onde:** Em qualquer ambiente em que você sobe a API com `bun run start` (Docker, Discloud, PM2, etc.), desde que `RUN_MIGRATE` não seja desativado.
- **Como desativar:** Defina `RUN_MIGRATE=false`. Aí as migrações **não** são rodadas na subida; alguém externo (pessoa ou pipeline de CI/CD) deve rodar `bun run migrate` com `DATABASE_URL` de produção antes (ou depois) do deploy.

Resumo:

| Quem roda as migrações | Quando usar |
|------------------------|-------------|
| **Aplicação na subida** (`RUN_MIGRATE=true`, padrão) | Deploy simples (Docker, Discloud, uma instância). Uma instância aplica as migrações; outras que subirem depois veem o schema já atualizado. |
| **CI / pessoa** (`RUN_MIGRATE=false` + `bun run migrate` no pipeline ou manual) | Quando o deploy exige um passo de migração separado (ex.: job de release que roda antes de trocar a versão da API). |

Variável em `.env` / ambiente:

```bash
# true = app roda migrações ao iniciar (padrão)
# false = você ou o CI roda "bun run migrate" antes do deploy
RUN_MIGRATE=true
```

### Múltiplas instâncias

Se várias réplicas sobem ao mesmo tempo, todas tentam rodar as migrações; o Drizzle aplica as pendentes e as demais operações ficam idempotentes. Para evitar qualquer corrida, use um único passo de migração antes do deploy (job de release ou `RUN_MIGRATE=false` e rode `bun run migrate` uma vez).

---

## Deploy com Docker

1. Build e run (a aplicação roda as migrações na subida, pois `RUN_MIGRATE` não é setado e vale `true`):

   ```bash
   docker build -t UniverseLogs .
   docker run -p 8080:8080 --env-file .env UniverseLogs
   ```

2. Se quiser que **só o pipeline/operador** rode migrações, defina no env do container:

   ```bash
   docker run -p 8080:8080 -e RUN_MIGRATE=false --env-file .env UniverseLogs
   ```

   e rode `bun run migrate` (ou um job que use a mesma imagem e `DATABASE_URL`) antes de subir os containers da API.

---

## Deploy na Discloud

1. Variáveis de ambiente no dashboard: `PORT=8080`, `HOST=0.0.0.0`, `DATABASE_URL`, `MASTER_KEY`, etc. (veja `.env.example`).
2. Com o padrão `RUN_MIGRATE=true`, ao subir a app a Discloud aplica as migrações antes de servir tráfego.
3. Para migrações só via CI/pessoa: no dashboard, crie a variável `RUN_MIGRATE=false` e rode `bun run migrate` (com `DATABASE_URL` de produção) no seu pipeline ou manualmente antes do próximo deploy.

---

## CI/CD (GitHub Actions)

A pipeline automatizada (`.github/workflows/pipeline.yml`) gerencia o ciclo de vida:

- **CI (Push em main/develop e PRs):**
  - Lint e Formatação (**Biome**)
  - Verificação de tipos (**TSC**)
  - Testes Unitários e Cobertura (**Vitest**)
  - Verificação de build **Docker**
- **CD (Apenas push em main):**
  - Deploy automático para a **Discloud** via `discloud/deploy-action`.
  - **Requisito:** Configure o secret `DISCLOUD_TOKEN` nas configurações do GitHub.

---

## Rodar migrações manualmente (CLI)

Sempre que precisar aplicar migrações fora do start da API (por exemplo com `RUN_MIGRATE=false`):

```bash
# Com .env carregado (produção)
bun run migrate

# Ou com env explícito
DATABASE_URL="postgresql://..." bun run migrate
```

O script usa `drizzle-kit migrate` e o `drizzle.config.ts` (que lê `DATABASE_URL` do ambiente).
