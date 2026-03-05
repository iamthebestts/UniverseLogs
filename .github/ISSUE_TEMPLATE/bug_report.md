---
name: Bug Report
about: Report incorrect or unexpected behavior in the API, SDK, or docs
title: "[Bug] "
labels: bug
assignees: ""
---

## Summary

One or two sentences describing the bug and its impact.

## Environment

| Item | Value |
|------|--------|
| **Runtime** | e.g. Bun 1.x, Node 20.x |
| **OS** | e.g. Windows 11, Ubuntu 22.04 |
| **API version / commit** | e.g. main @ abc1234 or Docker tag |
| **SDK (if applicable)** | e.g. Roblox client version or N/A |

## Steps to Reproduce

1. Start the server with `…` (or use SDK with config …).
2. Call `POST /api/logs` with body `…` (or equivalent SDK call).
3. Observe …

## Expected Behavior

What should happen (e.g. status code, response body, log persisted).

## Actual Behavior

What actually happens (status code, error message, logs, or missing data).

## Request / Response (optional)

```http
POST /api/logs HTTP/1.1
Host: localhost:3000
x-api-key: ***
Content-Type: application/json

{"level":"info","message":"test"}
```

```
Response: 500 Internal Server Error
Body: { "code": "...", "message": "..." }
```

## Additional Context

- Relevant config (no secrets): `AUTO_CREATE_UNIVERSE=true`, etc.
- Database or WebSocket involved? Yes/No.
- Any workaround you use today.
