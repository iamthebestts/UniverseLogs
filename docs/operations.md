# Guia de Operações - Logs API

Este documento descreve como operar, monitorar e manter o serviço de Logs API em produção.

## 1. Monitoramento e Métricas (Observabilidade)

A aplicação utiliza [Bun](https://bun.sh) e [Elysia](https://elysiajs.com). Para monitoramento em produção, observe:

### Principais Endpoints de Saúde:
- `GET /ping`: Resposta imediata `{"pong": true}` para Load Balancers.
- `GET /health`: Verifica conectividade com o Banco de Dados.

### Métricas Recomendadas (RED Method):
Como o sistema ainda não integra Prometheus/OpenTelemetry nativamente, utilize o log do servidor para monitorar:
- **Requests:** Volume de logs enviados por segundo.
- **Errors:** Frequência de erros 5xx ou Timeouts de banco.
- **Duration:** Latência média das rotas `/logs` e `/universes`.

## 2. Gerenciamento de Banco de Dados (Postgres)

O sistema usa **Drizzle ORM**.

### Migrations
As migrações são executadas automaticamente no startup do container se `RUN_MIGRATE=true`.
- **Verificar status:** Verifique os logs do container no início da execução.
- **Manual Rollback:** Requer acesso direto ao banco ou execução via CLI do Drizzle localmente.

### Conexões
Configure as variáveis `DB_MAX_CONNECTIONS` e `DB_IDLE_TIMEOUT` de acordo com a capacidade do seu cluster RDS/Postgres. O padrão é 10 conexões por instância.

## 3. Escalabilidade (Scaling)

### Horizontal Scaling
A aplicação é *stateless* e pode ser escalada horizontalmente.
- **Atenção:** O Rate Limiting atual é em memória. Escalar múltiplas instâncias sem um Redis centralizado aumentará o limite real de requisições por IP proporcionalmente ao número de réplicas.

### Recursos do Container
- **CPU/Memória:** Inicie com 512MB RAM e 0.5 vCPU. Bun é extremamente eficiente.

## 4. Runbook: Problemas Comuns

### 1. Database Connection Timeout
- **Sintoma:** `/health` retorna status `unavailable`.
- **Causa:** Banco de dados fora do ar ou pool de conexões exaurido.
- **Ação:** Aumentar `DB_MAX_CONNECTIONS` ou verificar carga no Postgres.

### 2. Memória Crescente
- **Sintoma:** Restart constante do container.
- **Causa:** O buffer de logs (`LogBuffer`) pode estar retendo muitos itens se o banco estiver lento.
- **Ação:** Verifique a performance das escritas na tabela de `logs`.

### 3. Falha na Migração
- **Sintoma:** O container trava no boot.
- **Ação:** Desabilite `RUN_MIGRATE=false`, suba o serviço e verifique manualmente as tabelas no banco.

## 5. Segurança

- **Master Key:** A `MASTER_KEY` deve ser rotacionada periodicamente e nunca exposta em logs.
- **API Keys:** Geradas via `/api-keys` para consumidores do serviço. Utilize o serviço interno para revogar chaves suspeitas.
