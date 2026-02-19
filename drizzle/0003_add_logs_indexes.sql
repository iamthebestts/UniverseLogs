-- Índices compostos para listagem, filtros e paginação cursor-based (GET /logs, GET /logs/count, DELETE /logs).
-- Nomes alinhados ao schema em src/db/schema.ts.
-- Para produção sem lock: CREATE INDEX CONCURRENTLY ... (rodar fora de transação).

-- Cursor-based pagination: ORDER BY timestamp DESC, id DESC (scan reverso usa este índice)
CREATE INDEX IF NOT EXISTS logs_universe_timestamp_id_idx
  ON logs (universe_id, timestamp DESC, id DESC);

CREATE INDEX IF NOT EXISTS logs_universe_level_idx
  ON logs (universe_id, level);

CREATE INDEX IF NOT EXISTS logs_universe_topic_idx
  ON logs (universe_id, topic);
