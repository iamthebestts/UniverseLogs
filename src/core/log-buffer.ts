import { db } from "@/db/client";
import { logs } from "@/db/schema";
import { env } from "@/env";
import { logger } from "./logger";

type LogInsert = typeof logs.$inferInsert;

export class LogBuffer {
  private queue: LogInsert[] = [];
  private flushInterval: number;
  private maxBatchSize: number;
  private timer: Timer | null = null;

  constructor() {
    this.flushInterval = env.NODE_ENV === "test" ? 100 : 5000;
    this.maxBatchSize = 1000;
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

export const logBuffer = new LogBuffer();
