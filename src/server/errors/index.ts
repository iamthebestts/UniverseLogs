/**
 * Error handler module barrel export
 * Provides easy access to all error types and utilities
 */

export {
  // Error classes
  ApiError, AuthError,
  AuthorizationError, ConflictError,
  DatabaseError,
  // Enums and interfaces
  ErrorCode, NotFoundError, RateLimitError, ServiceUnavailableError, ValidationError,
  // Type guards
  isApiError, type ApiErrorData,
  type ErrorLogContext
} from "./types";

export {
  ErrorLogger,
  // Logger instance
  logger,
  // Handler setup
  setupErrorHandler, setupErrorHandling, setupRequestIdMiddleware,
  setupRequestLoggingMiddleware
} from "../handlers/error-handler";

