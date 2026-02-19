/**
 * Error handler middleware for Elysia API
 * Captures, logs, and standardizes error responses
 */

import chalk from "chalk";
import { env } from "@/env";
import {
  type ApiErrorData,
  ErrorCode,
  type ErrorLogContext,
  isApiError,
} from "@/server/errors/types";

/** Stack/details only in DEV and TEST; PROD never exposes them (safe against information disclosure). */
const showDetailedErrors = env.NODE_ENV === "dev" || env.NODE_ENV === "test";

/**
 * Logger instance for error handling
 * In production, this would integrate with Winston/Pino
 */
class ErrorLogger {
  private showDetails: boolean;

  constructor(showDetails: boolean = showDetailedErrors) {
    this.showDetails = showDetails;
  }

  /**
   * Logs an error with structured context
   */
  logError(context: ErrorLogContext): void {
    const { statusCode, code, message, path, method, requestId, timestamp, stack, originalError } =
      context;

    const logLevel = statusCode >= 500 ? "error" : "warn";
    const logPrefix = statusCode >= 500 ? chalk.red("[ERROR]") : chalk.yellow("[WARN]");

    const logMessage = [
      logPrefix,
      `[${code}]`,
      `${method} ${path}`,
      `→ ${statusCode}`,
      `| ${message}`,
      requestId ? `| req:${requestId}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    console[logLevel === "error" ? "error" : "warn"](logMessage);

    // Log detailed context only in dev/test or for server errors (no stack in prod logs)
    if (this.showDetails || statusCode >= 500) {
      const details: Record<string, unknown> = {
        timestamp,
        code,
        statusCode,
        path,
        method,
        requestId,
        message,
      };

      if (this.showDetails && stack) {
        details.stack = stack;
      }

      if (originalError && this.showDetails) {
        details.originalError = {
          name: originalError.name,
          message: originalError.message,
          stack: originalError.stack,
          ...(originalError as any),
        };
      }

      const safeDetails = JSON.parse(
        JSON.stringify(details, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
      );

      console[logLevel === "error" ? "error" : "warn"](safeDetails);
    }
  }

  /**
   * Logs request context at startup (info level)
   */
  logInfo(message: string, data?: Record<string, unknown>): void {
    console.log(chalk.blue(`[INFO] ${message}`), data ?? "");
  }
}

// Global error logger
const logger = new ErrorLogger();

/**
 * Global error handler plugin for Elysia
 * Integrates as app.onError() hook to catch all route errors
 *
 * @example
 * ```typescript
 * const app = new Elysia()
 *   .use(setupErrorHandler());
 * ```
 */
export function setupErrorHandler(app: any) {
  logger.logInfo("Error handler initialized", {
    environment: env.NODE_ENV,
    detailedErrors: showDetailedErrors,
  });

  app.onError(({ code: elyCode, error, request, set, path }: any) => {
    const method = request.method as string;
    const requestId = (request.headers.get("x-request-id") as string) ?? undefined;
    const timestamp = new Date().toISOString();

    let statusCode = 500;
    let errorCode = ErrorCode.INTERNAL_ERROR;
    let errorMessage = "Internal server error";
    let details: Record<string, unknown> | undefined;
    let retryAfter: number | undefined;

    if (isApiError(error as any)) {
      const apiErr = error as any;
      statusCode = apiErr.statusCode;
      errorCode = apiErr.code;
      errorMessage = apiErr.message;
      retryAfter = apiErr.retryAfter;
      details = showDetailedErrors ? apiErr.details : undefined;
    } else if (error instanceof SyntaxError) {
      statusCode = 400;
      errorCode = ErrorCode.INVALID_REQUEST;
      errorMessage = "Invalid request format";
      if (showDetailedErrors) {
        details = { error: error.message };
      }
    } else if (error instanceof Error) {
      statusCode = 500;
      errorCode = ErrorCode.INTERNAL_ERROR;
      errorMessage = showDetailedErrors ? error.message : "Internal server error";
      if (showDetailedErrors) {
        details = {
          name: error.name,
          stack: error.stack,
        };
      }
    }

    if (elyCode === "VALIDATION") {
      statusCode = 400;
      errorCode = ErrorCode.VALIDATION_FAILED;
      errorMessage = "Validation failed";
      if (showDetailedErrors) {
        details = { error };
      }
    } else if (elyCode === "NOT_FOUND") {
      statusCode = 404;
      errorCode = ErrorCode.NOT_FOUND;
      errorMessage = "Endpoint not found";
    }

    const logContext: ErrorLogContext = {
      statusCode,
      code: errorCode,
      message: errorMessage,
      path,
      method,
      requestId,
      timestamp,
      isDevelopment: showDetailedErrors,
      stack: error instanceof Error ? error.stack : undefined,
      originalError: error instanceof Error ? error : undefined,
    };

    logger.logError(logContext);

    const errorResponse: ApiErrorData = {
      code: errorCode,
      message: errorMessage,
      statusCode,
      timestamp,
      path,
      requestId,
      details,
    };

    set.status = statusCode;
    set.headers["content-type"] = "application/json";

    if (errorCode === ErrorCode.RATE_LIMITED) {
      const headerValue = retryAfter ?? (details?.retryAfter as number | undefined);
      if (headerValue != null) {
        set.headers["retry-after"] = String(headerValue);
      }
    }

    return errorResponse;
  });

  return app;
}

/**
 * Request ID generator middleware
 * Assigns unique ID to each request for tracing
 */
export function setupRequestIdMiddleware(app: any) {
  app.derive(({ request }: any) => {
    const requestId =
      request.headers.get("x-request-id") ??
      `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return { requestId };
  });

  return app;
}

/**
 * Request logging middleware
 * Logs incoming requests (optional, for debugging)
 */
export function setupRequestLoggingMiddleware(app: any) {
  if (env.NODE_ENV !== "dev") {
    return app; // Skip in production
  }

  app.onBeforeHandle(({ request, path }: any) => {
    const method = request.method as string;
    const log = chalk.cyan(`[REQ] ${method} ${path}`);
    console.log(log);
  });

  return app;
}

/**
 * Composite setup function to apply all error handling
 */
export function setupErrorHandling(app: any) {
  setupRequestIdMiddleware(app);
  setupRequestLoggingMiddleware(app);
  setupErrorHandler(app);

  logger.logInfo("All error handling middleware configured");

  return app;
}

export { ErrorLogger, logger };
