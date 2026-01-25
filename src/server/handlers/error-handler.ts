/**
 * Error handler middleware for Elysia API
 * Captures, logs, and standardizes error responses
 */

import { env } from "@/env";
import {
  type ApiErrorData,
  ErrorCode,
  type ErrorLogContext,
  isApiError,
} from "@/server/errors/types";
import chalk from "chalk";

/**
 * Logger instance for error handling
 * In production, this would integrate with Winston/Pino
 */
class ErrorLogger {
  private isDevelopment: boolean;

  constructor(isDevelopment: boolean = env.NODE_ENV === "dev") {
    this.isDevelopment = isDevelopment;
  }

  /**
   * Logs an error with structured context
   */
  logError(context: ErrorLogContext): void {
    const {
      statusCode,
      code,
      message,
      path,
      method,
      requestId,
      timestamp,
      stack,
      originalError,
    } = context;

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

    // Log detailed context in development or for server errors
    if (this.isDevelopment || statusCode >= 500) {
      const details: Record<string, unknown> = {
        timestamp,
        code,
        statusCode,
        path,
        method,
        requestId,
        message,
      };

      if (this.isDevelopment && stack) {
        details.stack = stack;
      }

      if (originalError && this.isDevelopment) {
        details.originalError = {
          name: originalError.name,
          message: originalError.message,
          stack: originalError.stack,
        };
      }

      console[logLevel === "error" ? "error" : "warn"](details);
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
 * Builds a standardized error response
 */
function buildErrorResponse(
  error: unknown,
  path?: string,
  requestId?: string
): ApiErrorData {
  const isDevelopment = env.NODE_ENV === "dev";
  const timestamp = new Date().toISOString();

  if (isApiError(error)) {
    return {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      timestamp,
      path: path ?? error.path,
      requestId: requestId ?? error.requestId,
      details: isDevelopment ? error.details : undefined,
    };
  }

  // Handle native Error objects
  if (error instanceof Error) {
    const statusCode = 500;
    const code = ErrorCode.INTERNAL_ERROR;
    const message = isDevelopment ? error.message : "Internal server error";

    return {
      code,
      message,
      statusCode,
      timestamp,
      path,
      requestId,
      details: isDevelopment
        ? {
          name: error.name,
          stack: error.stack,
        }
        : undefined,
    };
  }

  // Handle unknown errors
  return {
    code: ErrorCode.UNKNOWN_ERROR,
    message: "An unexpected error occurred",
    statusCode: 500,
    timestamp,
    path,
    requestId,
    details: isDevelopment
      ? { error: String(error) }
      : undefined,
  };
}

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
    detailedErrors: env.NODE_ENV === "dev",
  });

  app.onError(
    ({ code: elyCode, error, request, set, path }: any) => {
      const isDevelopment = env.NODE_ENV === "dev";
      const method = request.method as string;
      const requestId = request.headers.get("x-request-id") as string ?? undefined;
      const timestamp = new Date().toISOString();

      // Extract status code from error if it's ApiError
      let statusCode = 500;
      let errorCode = ErrorCode.INTERNAL_ERROR;
      let errorMessage = "Internal server error";
      let details: Record<string, unknown> | undefined;
      let originalError: Error | undefined;

      if (isApiError(error as any)) {
        const apiErr = error as any;
        statusCode = apiErr.statusCode;
        errorCode = apiErr.code;
        errorMessage = apiErr.message;
        details = isDevelopment ? apiErr.details : undefined;
      } else if (error instanceof SyntaxError) {
        // Handle JSON parse errors
        statusCode = 400;
        errorCode = ErrorCode.INVALID_REQUEST;
        errorMessage = "Invalid request format";
        if (isDevelopment) {
          details = { error: error.message };
        }
      } else if (error instanceof Error) {
        statusCode = 500;
        errorCode = ErrorCode.INTERNAL_ERROR;
        errorMessage = isDevelopment ? error.message : "Internal server error";
        originalError = error;
        if (isDevelopment) {
          details = {
            name: error.name,
            stack: error.stack,
          };
        }
      }

      // Handle Elysia-specific codes
      if (elyCode === "VALIDATION") {
        statusCode = 400;
        errorCode = ErrorCode.VALIDATION_FAILED;
        errorMessage = "Validation failed";
        if (isDevelopment) {
          details = { error };
        }
      } else if (elyCode === "NOT_FOUND") {
        statusCode = 404;
        errorCode = ErrorCode.NOT_FOUND;
        errorMessage = "Endpoint not found";
      }

      // Log the error
      const logContext: ErrorLogContext = {
        statusCode,
        code: errorCode,
        message: errorMessage,
        path,
        method,
        requestId,
        timestamp,
        isDevelopment,
        stack: error instanceof Error ? error.stack : undefined,
        originalError: error instanceof Error ? error : undefined,
      };

      logger.logError(logContext);

      // Build and set response
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

      // Add Retry-After header for rate limit errors
      if (errorCode === ErrorCode.RATE_LIMITED && details?.retryAfter) {
        set.headers["retry-after"] = String(details.retryAfter);
      }

      return errorResponse;
    }
  );

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
