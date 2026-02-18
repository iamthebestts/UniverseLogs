import { env } from "@/env";
import chalk from "chalk";

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

class Logger {
  private isDev = env.NODE_ENV === "dev";

  private format(level: LogLevel, message: string, meta: Record<string, unknown> = {}) {
    const timestamp = new Date().toISOString();

    if (this.isDev) {
      // Pretty print for development
      const color = this.getColor(level);
      const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : "";
      return `${chalk.gray(timestamp)} ${color(`[${level.toUpperCase()}]`)} ${message}${chalk.gray(metaStr)}`;
    }

    // JSON structure for production
    const entry: LogEntry = {
      level,
      timestamp,
      message,
      service: "logs-api",
      ...meta,
    };
    return JSON.stringify(entry, (_, value) => 
      typeof value === "bigint" ? value.toString() : value
    );
  }

  private getColor(level: LogLevel) {
    switch (level) {
      case "info": return chalk.blue;
      case "warn": return chalk.yellow;
      case "error": return chalk.red;
      case "debug": return chalk.magenta;
      default: return chalk.white;
    }
  }

  info(message: string, meta?: Record<string, unknown>) {
    console.log(this.format("info", message, meta));
  }

  warn(message: string, meta?: Record<string, unknown>) {
    console.warn(this.format("warn", message, meta));
  }

  error(message: string, meta?: Record<string, unknown>) {
    console.error(this.format("error", message, meta));
  }

  debug(message: string, meta?: Record<string, unknown>) {
    if (this.isDev) {
      console.debug(this.format("debug", message, meta));
    }
  }
}

export const logger = new Logger();
