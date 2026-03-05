# WebSocket Realtime API

O serviço de Realtime permite a conexão bidirecional entre clientes e o servidor de logs, possibilitando o monitoramento de eventos em tempo real e a execução de comandos rápidos.

## Endpoint

`ws://<host>:<port>/realtime`

---

## Autenticação

A autenticação é realizada durante o handshake inicial do WebSocket via header HTTP.

| Header | Descrição |
|--------|-----------|
| `x-api-key` | Chave de acesso do universo (tenant) |

Se a chave for inválida ou estiver ausente, a conexão será fechada com um dos seguintes códigos:

- `4001`: Chave de API ausente.
- `4002`: Chave de API inválida ou revogada.

---

## Ciclo de Vida da Conexão

1. **Handshake**: O cliente envia o header `x-api-key`.
2. **Conectado**: O servidor envia uma mensagem de boas-vindas:

   ```json
   {
     "type": "CONNECTED",
     "universeId": "12345678",
     "timestamp": "2026-02-15T..."
   }
   ```

3. **Atividade**: O cliente pode enviar comandos ou apenas ouvir logs.
4. **Fechamento**: Quando o socket fecha, o servidor remove o cliente do gerenciador de broadcast automaticamente.

---

## Mensagens do Cliente (Comandos)

O servidor processa mensagens no formato JSON: `{ "type": "COMANDO", "payload": {} }`.

### 1. PING

Mantém a conexão ativa e testa a latência.

- **Payload**: Nenhum.
- **Resposta**: `{ "type": "PONG", "timestamp": "..." }`

### 2. QUERY_LOGS

Lista logs com os mesmos filtros do `GET /api/logs` (level, topic, from, to, cursor, limit).

- **Payload**: `{ "level"?, "topic"?, "from"?, "to"?, "cursor_ts"?, "cursor_id"?, "limit"? }` (limit máx. 100).
- **Resposta**: `{ "type": "LOGS_QUERY_RESULT", "logs": [...], "nextCursor"?: { "cursor_ts", "cursor_id" } }`

> **Nota de Versão (v1.1.0)**: Os campos de cursor foram renomeados de `timestamp`/`id` para `cursor_ts`/`cursor_id` para maior clareza.
>
> **Guia de Migração**:
>
> - **Antigo**: `{ "timestamp": "...", "id": "..." }`
> - **Novo**: `{ "cursor_ts": "...", "cursor_id": "..." }`
>
> Para compatibilidade, o servidor aceita ambos os formatos no payload de requisição, mas retornará apenas o novo formato em `nextCursor`.

### 3. QUERY_LOGS_COUNT

Contagem total e por level (equivalente a `GET /api/logs/count`).

- **Payload**: `{ "from"?, "to"? }` (datas ISO).
- **Resposta**: `{ "type": "LOGS_COUNT_RESULT", "total": number, "byLevel": { "trace": number, "debug": number, "info": number, "warn": number, "error": number, "fatal": number } }`
- **Nota**: O campo `byLevel` é um mapa de nomes de níveis de log para a contagem inteira. Todas as chaves para os níveis suportados (`trace`, `debug`, `info`, `warn`, `error`, `fatal`) estão sempre presentes, com valor 0 se não houver logs para aquele nível.

**Exemplo de Resposta**:

```json
{
  "type": "LOGS_COUNT_RESULT",
  "total": 150,
  "byLevel": {
    "trace": 0,
    "debug": 10,
    "info": 100,
    "warn": 30,
    "error": 10,
    "fatal": 0
  }
}
```

### 4. DELETE_LOGS

Remove logs por `olderThan` e filtros opcionais (equivalente a `DELETE /api/logs`).

- **Payload**: `{ "olderThan": "ISO date", "confirm": true, "level"?, "topic"? }`
- **Nota**: O campo `confirm` é obrigatório para evitar deleções acidentais. Se ausente ou `false`, o servidor retorna `{ "type": "ERROR", "message": "Campo 'confirm' obrigatório para confirmar deleção" }`. O comando é sujeito a rate limiting e exige permissões elevadas. Deleções são auditadas.
- **Resposta**: `{ "type": "LOGS_DELETED", "deleted": number }`

### 5. SEND_LOGS_BULK

Cria vários logs em lote (equivalente a `POST /api/logs/bulk`).

- **Payload**: `{ "logs": [{ "level", "message", "metadata"?, "topic"? }, ...] }` (máx. 100 itens).
- **Nota**: A operação é atômica (all-or-nothing). Se algum log falhar na validação (campos obrigatórios: `level`, `message`), nenhum será inserido.
- **Resposta (Sucesso)**: `{ "type": "LOGS_BULK_CREATED", "count": number }`
- **Resposta (Erro)**: `{ "type": "ERROR", "message": "Validation failed", "errors": [{ "index": number, "reason": string }, ...] }`

### 6. SEND_LOG

Cria um novo log diretamente via WebSocket.

- **Payload**: Mesmo objeto do `POST /api/logs`.
- **Resposta**: `{ "type": "LOG_CREATED", "id": "uuid" }`

---

## Mensagens do Servidor (Eventos)

### 1. Novo Log (Broadcast)

Enviado para todos os clientes conectados a um `universeId` quando um novo log é gerado (seja via HTTP ou WS).

```json
{
  "id": "uuid",
  "universe_id": "...",
  "level": "info",
  "message": "...",
  "topic": "...",
  "metadata": {},
  "timestamp": "..."
}
```

### 2. Erro

Enviado quando um comando falha ou o formato é inválido.

```json
{
  "type": "ERROR",
  "message": "Descrição do erro"
}
```

---

## Exemplo de Implementação (JavaScript)

```javascript
const socket = new WebSocket('ws://localhost:3000/realtime', {
  headers: { 'x-api-key': 'sua-chave-aqui' }
});

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'CONNECTED') {
    console.log('Logado no universo:', data.universeId);
  } else if (data.level) {
    console.log('Log em tempo real:', data.message);
  }
};

// Exemplo de comando
function getHistory() {
  socket.send(JSON.stringify({
    type: 'QUERY_LOGS',
    payload: { limit: 10 }
  }));
}
```
