/**
 * Error handler module barrel export
 * Provides easy access to all error types and utilities
 */

export {
  ErrorLogger,
  // Logger instance
  logger,
  // Handler setup
  setupErrorHandler,
  setupErrorHandling,
  setupRequestIdMiddleware,
  setupRequestLoggingMiddleware,
} from "../handlers/error-handler";
export {
  // Error classes
  ApiError,
  type ApiErrorData,
  AuthError,
  AuthorizationError,
  ConflictError,
  DatabaseError,
  // Enums and interfaces
  ErrorCode,
  type ErrorLogContext,
  // Type guards
  isApiError,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  ValidationError,
} from "./types";
