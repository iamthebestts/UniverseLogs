/**
 * Normaliza um log para resposta (REST e WebSocket).
 */
export function normalizeLogResponse(log: Record<string, unknown>) {
  return {
    ...log,
    topic: log.topic ?? null,
    metadata: log.metadata ?? {},
    timestamp: log.timestamp != null ? log.timestamp : new Date().toISOString(),
  };
}
