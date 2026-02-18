import { db } from "@/db/client";
import { logs } from "@/db/schema";
import { logger } from "./logger";

type LogInsert = typeof logs.$inferInsert;

export class LogBuffer {
  private queue: LogInsert[] = [];
  private flushInterval: number;
  private maxBatchSize: number;
  private timer: Timer | null = null;

  constructor(flushIntervalMs = 5000, maxBatchSize = 1000) {
    this.flushInterval = flushIntervalMs;
    this.maxBatchSize = maxBatchSize;
    this.startTimer();
  }

  public add(log: LogInsert) {
    this.queue.push(log);
    if (this.queue.length >= this.maxBatchSize) {
      this.flush();
    }
  }

  public async flush() {
    if (this.queue.length === 0) return;

    const batch = [...this.queue];
    this.queue = [];

    try {
      await db.insert(logs).values(batch);
      logger.info(`[buffer] Flushed ${batch.length} logs to database.`);
    } catch (error) {
      logger.error("[buffer] Failed to flush logs to database", { error });
      // Na prática real, poderíamos tentar reenfileirar ou salvar em arquivo de dead-letter
      // Por enquanto, apenas logamos o erro para não travar a aplicação
    }
  }

  private startTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    return this.flush();
  }
}

// Singleton instance
export const logBuffer = new LogBuffer();
