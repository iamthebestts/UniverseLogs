# WebSocket Realtime API

The Realtime service provides a bidirectional connection between clients and the log server for real-time event monitoring and quick commands.

## Endpoint

`ws://<host>:<port>/realtime`

---

## Authentication

Authentication is done during the initial WebSocket handshake via an HTTP header.

| Header     | Description |
|------------|-------------|
| `x-api-key`| Universe (tenant) access key |

If the key is invalid or missing, the connection is closed with one of:

- `4001`: API key missing.
- `4002`: API key invalid or revoked.

---

## Connection Lifecycle

1. **Handshake:** Client sends the `x-api-key` header.
2. **Connected:** Server sends a welcome message:

   ```json
   {
     "type": "CONNECTED",
     "universeId": "12345678",
     "timestamp": "2026-02-15T..."
   }
   ```

3. **Activity:** Client can send commands or only listen for logs.
4. **Close:** When the socket closes, the server removes the client from the broadcast manager automatically.

---

## Client Messages (Commands)

The server expects JSON: `{ "type": "COMMAND", "payload": {} }`.

### 1. PING

Keeps the connection alive and tests latency.

- **Payload:** None.
- **Response:** `{ "type": "PONG", "timestamp": "..." }`

### 2. QUERY_LOGS

Lists logs with the same filters as `GET /api/logs` (level, topic, from, to, cursor, limit).

- **Payload:** `{ "level"?, "topic"?, "from"?, "to"?, "cursor_ts"?, "cursor_id"?, "limit"? }` (limit max 100).
- **Response:** `{ "type": "LOGS_QUERY_RESULT", "logs": [...], "nextCursor"?: { "cursor_ts", "cursor_id" } }`

> **Version note (v1.1.0):** Cursor fields were renamed from `timestamp`/`id` to `cursor_ts`/`cursor_id` for clarity.
>
> **Migration:** Old: `{ "timestamp": "...", "id": "..." }` → New: `{ "cursor_ts": "...", "cursor_id": "..." }`
>
> For compatibility, the server accepts both formats in the request payload but returns only the new format in `nextCursor`.

### 3. QUERY_LOGS_COUNT

Total and per-level count (same as `GET /api/logs/count`).

- **Payload:** `{ "from"?, "to"? }` (ISO dates).
- **Response:** `{ "type": "LOGS_COUNT_RESULT", "total": number, "byLevel": { "trace": number, "debug": number, "info": number, "warn": number, "error": number, "fatal": number } }`
- **Note:** `byLevel` is a map of log level names to counts. All supported levels (`trace`, `debug`, `info`, `warn`, `error`, `fatal`) are always present, with 0 when there are no logs for that level.

**Example response:**

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

Removes logs by `olderThan` and optional filters (same as `DELETE /api/logs`).

- **Payload:** `{ "olderThan": "ISO date", "confirm": true, "level"?, "topic"? }`
- **Note:** `confirm` is required to avoid accidental deletion. If missing or `false`, the server returns `{ "type": "ERROR", "message": "'confirm' field required to confirm deletion" }`. The command is rate-limited and requires elevated permissions. Deletions are audited.
- **Response:** `{ "type": "LOGS_DELETED", "deleted": number }`

### 5. SEND_LOGS_BULK

Creates multiple logs in bulk (same as `POST /api/logs/bulk`).

- **Payload:** `{ "logs": [{ "level", "message", "metadata"?, "topic"? }, ...] }` (max 100 items).
- **Note:** Operation is atomic (all-or-nothing). If any log fails validation (required: `level`, `message`), none are inserted.
- **Success:** `{ "type": "LOGS_BULK_CREATED", "count": number }`
- **Error:** `{ "type": "ERROR", "message": "Validation failed", "errors": [{ "index": number, "reason": string }, ...] }`

### 6. SEND_LOG

Creates a new log directly over WebSocket.

- **Payload:** Same object as `POST /api/logs`.
- **Response:** `{ "type": "LOG_CREATED", "id": "uuid" }`

---

## Server Messages (Events)

### 1. New Log (Broadcast)

Sent to all clients connected to a `universeId` when a new log is created (via HTTP or WS).

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

### 2. Error

Sent when a command fails or the format is invalid.

```json
{
  "type": "ERROR",
  "message": "Error description"
}
```

---

## Example Implementation (JavaScript)

```javascript
const socket = new WebSocket('ws://localhost:3000/realtime', {
  headers: { 'x-api-key': 'your-key-here' }
});

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'CONNECTED') {
    console.log('Connected to universe:', data.universeId);
  } else if (data.level) {
    console.log('Real-time log:', data.message);
  }
};

function getHistory() {
  socket.send(JSON.stringify({
    type: 'QUERY_LOGS',
    payload: { limit: 10 }
  }));
}
```
