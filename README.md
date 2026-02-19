# Logs API 🚀

![Build Status](https://img.shields.io/badge/tests-passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Tech Stack](https://img.shields.io/badge/stack-Bun_Elysia_Drizzle_Postgres-orange)

**API de Ingestão e Consulta de Logs Estruturados de Alta Performance.**

Projetada para resolver o problema de observabilidade em **Jogos Distribuídos (Roblox/Unity)** e **Microsserviços**, onde a centralização de logs em tempo real é crítica para debugging, auditoria e telemetria.

---

## 🏗️ Arquitetura e Performance

A solução utiliza um design focado em **baixa latência de escrita** (Write-Heavy) e **isolamento multi-tenant**.

```mermaid
flowchart LR

  %% CLIENT
  C[Game Clients<br/>Roblox · Unity · Apps]

  %% GATEWAY
  R[Router]
  RL[Rate Limiter]
  AUTH{API Key<br/>Validation}

  %% ENGINE
  LB[(In-Memory<br/>Log Buffer)]
  WS[WebSocket<br/>Manager]

  %% STORAGE
  DB[(PostgreSQL<br/>JSONB)]

  %% DASHBOARD
  DASH[Live Dashboard]

  %% FLOW
  C -->|HTTPS| R
  R --> RL --> AUTH
  AUTH -->|Async Write| LB
  AUTH -->|Realtime| WS
  LB -->|Batch Insert 5s| DB
  WS -->|WS Stream| DASH
```

### Destaques Técnicos
- **In-Memory Log Buffer:** Agrupamento de inserções em lotes (Batch Processing) para evitar gargalos no PostgreSQL.
- **Realtime WebSockets:** Streaming de logs instantâneo para dashboards conectados.
- **Multi-Tenant Nativo:** Isolamento rigoroso de dados por `UniverseId` (Tenant) via hashes de API Keys.
- **Segurança Pronta:** Rate limiting granular, security headers (OWASP) e Graceful Shutdown.
- **Logger Estruturado:** Geração de logs JSON em produção para fácil integração com Datadog/ELK.

---

## ⚡ Início Rápido (Local)

### 1. Preparação
- **Bun** instalado (`curl -fsSL https://bun.sh/install | bash`)
- Instância do **PostgreSQL** ativa

### 2. Instalação e Configuração
```bash
git clone https://github.com/iamthebestts/logs-api
cd logs-api
bun install
cp .env.example .env
```
> Edite o `.env` e configure sua `DATABASE_URL` e `MASTER_KEY`.

### 3. Execução
```bash
bun run dev   # Modo desenvolvimento (com logs coloridos)
bun run start # Modo produção (performance máxima)
```

---

## 🛠️ Primeiros Passos (Operacional)

Após subir a API, você precisa criar sua primeira chave de acesso:

1. **Crie uma API Key via Rota Interna:**
   ```bash
   curl -X POST http://localhost:3000/internal/keys/register \
     -H "Content-Type: application/json" \
     -H "x-master-key: SUA_MASTER_KEY_AQUI" \
     -d '{"universeId": "123456"}'
   ```
2. **Use a chave retornada para enviar logs:**
   ```bash
   curl -X POST http://localhost:3000/api/logs \
     -H "x-api-key: CHAVE_RETORNADA" \
     -d '{"level": "info", "message": "API operacional!"}'
   ```

---

## 🧪 Qualidade e Testes

O projeto possui uma suíte de testes robusta que garante a integridade dos fluxos críticos.

- **Testes Unitários/Integração:** Validação de lógica com mocks.
- **Testes E2E (End-to-End):** Validação real com banco de dados, testando autenticação, buffer e limites de taxa.

```bash
bun test              # Roda testes unitários
bun run test:e2e      # Roda testes E2E (Requer banco 'logs_test')
bun run test:coverage # Relatório de cobertura
```

---

## 📚 Documentação Complementar

- 🌐 **[Guia de Rotas REST](./docs/rotas.md)**
- 🔌 **[WebSocket Realtime](./docs/websocket.md)**
- 🚀 **[Guia de Deployment](./docs/deploy.md)**
- 📖 **Swagger UI**: Disponível em `/docs` com o servidor rodando.

---

## 📄 Licença

Distribuído sob a licença MIT. Veja `LICENSE` para mais informações.

---
Desenvolvido por [iamthebestts](https://github.com/iamthebestts) 🚀

---

<div align="center">
  <img src="./images/Nexo.png" alt="Nexo+ Logo" width="120" />
  <h3>🚀 Precisa de uma API ou Bot Personalizado?</h3>
  <p>A <strong>Nexo+</strong> vai além do Roblox! Se você precisa de uma API específica, integração de sistemas ou um bot dedicado para automatizar seus processos, nós desenvolvemos a solução ideal para você.</p>
  <p>Unimos criatividade e eficiência para oferecer serviços completos no <strong>Roblox Studio</strong> (builds e scripts) e desenvolvimento especializado de <strong>APIs e Bots</strong> sob medida.</p>
  <p><strong>Transforme sua ideia em realidade agora:</strong><br/>
  👉 <a href="https://discord.gg/EPucmXpDQR">https://discord.gg/EPucmXpDQR</a></p>
</div>
