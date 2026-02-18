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
Solicita logs históricos do universo atual via socket.
- **Payload**: `{ "limit": number }` (Max: 100).
- **Resposta**: `{ "type": "LOGS_QUERY_RESULT", "logs": [...] }`

### 3. SEND_LOG
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
