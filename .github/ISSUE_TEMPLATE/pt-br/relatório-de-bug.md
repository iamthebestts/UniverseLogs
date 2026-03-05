---
name: Relatório de Bug
about: Reportar comportamento incorreto ou inesperado na API, SDK ou documentação
title: "[Bug] "
labels: bug
assignees: ""
---

## Resumo

Uma ou duas frases descrevendo o bug e o impacto.

## Ambiente

| Item | Valor |
|------|--------|
| **Runtime** | ex.: Bun 1.x, Node 20.x |
| **SO** | ex.: Windows 11, Ubuntu 22.04 |
| **Versão / commit da API** | ex.: main @ abc1234 ou tag Docker |
| **SDK (se aplicável)** | ex.: versão do cliente Roblox ou N/A |

## Passos para Reproduzir

1. Inicie o servidor com `…` (ou use o SDK com config …).
2. Chame `POST /api/logs` com body `…` (ou chamada equivalente no SDK).
3. Observe …

## Comportamento Esperado

O que deveria acontecer (ex.: código de status, corpo da resposta, log persistido).

## Comportamento Atual

O que de fato acontece (código de status, mensagem de erro, logs ou dado faltando).

## Request / Response (opcional)

```http
POST /api/logs HTTP/1.1
Host: localhost:3000
x-api-key: ***
Content-Type: application/json

{"level":"info","message":"teste"}
```

```
Resposta: 500 Internal Server Error
Body: { "code": "...", "message": "..." }
```

## Contexto Adicional

- Config relevante (sem segredos): `AUTO_CREATE_UNIVERSE=true`, etc.
- Banco de dados ou WebSocket envolvido? Sim/Não.
- Algum workaround que você usa hoje.
