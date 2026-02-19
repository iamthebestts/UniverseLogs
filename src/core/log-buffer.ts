import { db } from "@/db/client";
import { logs } from "@/db/schema";
import { env } from "@/env";
import { logger } from "./logger";

type LogInsert = typeof logs.$inferInsert;

export class LogBuffer {
  private queue: LogInsert[] = [];
  private maxBatchSize: number;
  private timer: Timer | null = null;
  private manualInterval: number | null = null;

  private get isTest() {
    return (
      process.env.NODE_ENV === "test" ||
      !!process.env.BUN_TEST ||
      !!process.env.VITEST ||
      (typeof env !== "undefined" && env.NODE_ENV === "test")
    );
  }

  private get flushInterval() {
    if (this.manualInterval !== null) return this.manualInterval;
    return this.isTest ? 100 : 5000;
  }

  public setFlushInterval(ms: number) {
    if (!Number.isFinite(ms) || ms <= 0) {
      logger.warn(`[buffer] Invalid flush interval: ${ms}. Must be a positive finite number.`);
      return;
    }
    this.manualInterval = ms;
    this.startTimer();
    logger.info(`[buffer] Flush interval updated to ${ms}ms (isTest: ${this.isTest})`);
  }

  constructor() {
    this.maxBatchSize = 1000;
    // No logging here to avoid singleton early-init noise if logger isn't ready
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
