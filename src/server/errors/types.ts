/**
 * Custom error types and interfaces for the API
 * Provides typed, categorized errors with proper handling
 */

export enum ErrorCode {
  // Validation errors (400)
  INVALID_REQUEST = "INVALID_REQUEST",
  INVALID_BODY = "INVALID_BODY",
  INVALID_QUERY = "INVALID_QUERY",
  INVALID_PARAMS = "INVALID_PARAMS",
  VALIDATION_FAILED = "VALIDATION_FAILED",

  // Authentication errors (401)
  UNAUTHORIZED = "UNAUTHORIZED",
  MISSING_AUTH = "MISSING_AUTH",
  INVALID_TOKEN = "INVALID_TOKEN",
  INVALID_API_KEY = "INVALID_API_KEY",
  EXPIRED_KEY = "EXPIRED_KEY",

  // Authorization errors (403)
  FORBIDDEN = "FORBIDDEN",
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
  RESOURCE_NOT_ALLOWED = "RESOURCE_NOT_ALLOWED",

  // Rate limiting (429)
  RATE_LIMITED = "RATE_LIMITED",
  TOO_MANY_REQUESTS = "TOO_MANY_REQUESTS",

  // Not found (404)
  NOT_FOUND = "NOT_FOUND",
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",

  // Conflict (409)
  CONFLICT = "CONFLICT",
  DUPLICATE_RESOURCE = "DUPLICATE_RESOURCE",

  // Server errors (500)
  INTERNAL_ERROR = "INTERNAL_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",

  // Generic
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export interface ApiErrorData {
  code: ErrorCode;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
  timestamp: string;
  path?: string;
  requestId?: string;
}

/**
 * Base class for all API errors
 * Extends Error to maintain stack traces
 */
export class ApiError extends Error {
  code: ErrorCode;
  statusCode: number;
  details?: Record<string, unknown>;
  timestamp: string;
  path?: string;
  requestId?: string;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    options?: {
      details?: Record<string, unknown>;
      path?: string;
      requestId?: string;
    },
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.message = message;
    this.statusCode = statusCode;
    this.details = options?.details;
    this.path = options?.path;
    this.requestId = options?.requestId;
    this.timestamp = new Date().toISOString();

    Object.setPrototypeOf(this, ApiError.prototype);
  }

  toJSON(): ApiErrorData {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
      path: this.path,
      requestId: this.requestId,
    };
  }
}

/**
 * Validation error - 400
 * For invalid request body, query params, or path params
 */
export class ValidationError extends ApiError {
  constructor(
    message: string,
    options?: {
      details?: Record<string, unknown>;
      path?: string;
      requestId?: string;
    },
  ) {
    super(ErrorCode.VALIDATION_FAILED, message, 400, options);
    this.name = "ValidationError";
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Authentication error - 401
 * For missing or invalid API keys, tokens
 */
export class AuthError extends ApiError {
  constructor(
    message: string = "Unauthorized",
    options?: {
      code?: ErrorCode;
      details?: Record<string, unknown>;
      path?: string;
      requestId?: string;
    },
  ) {
    const code = options?.code ?? ErrorCode.INVALID_API_KEY;
    super(code, message, 401, {
      details: options?.details,
      path: options?.path,
      requestId: options?.requestId,
    });
    this.name = "AuthError";
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

/**
 * Authorization error - 403
 * For insufficient permissions
 */
export class AuthorizationError extends ApiError {
  constructor(
    message: string = "Forbidden",
    options?: {
      details?: Record<string, unknown>;
      path?: string;
      requestId?: string;
    },
  ) {
    super(ErrorCode.FORBIDDEN, message, 403, options);
    this.name = "AuthorizationError";
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

/**
 * Rate limit error - 429
 * For rate limit exceeded
 */
export class RateLimitError extends ApiError {
  retryAfter?: number;

  constructor(
    message: string = "Rate limit exceeded",
    retryAfter?: number,
    options?: {
      details?: Record<string, unknown>;
      path?: string;
      requestId?: string;
    },
  ) {
    super(ErrorCode.RATE_LIMITED, message, 429, {
      details: {
        ...options?.details,
        retryAfter,
      },
      path: options?.path,
      requestId: options?.requestId,
    });
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Not found error - 404
 */
export class NotFoundError extends ApiError {
  constructor(
    message: string = "Resource not found",
    options?: {
      details?: Record<string, unknown>;
      path?: string;
      requestId?: string;
    },
  ) {
    super(ErrorCode.NOT_FOUND, message, 404, options);
    this.name = "NotFoundError";
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Conflict error - 409
 * For duplicate resources or state conflicts
 */
export class ConflictError extends ApiError {
  constructor(
    message: string = "Conflict",
    options?: {
      details?: Record<string, unknown>;
      path?: string;
      requestId?: string;
    },
  ) {
    super(ErrorCode.CONFLICT, message, 409, options);
    this.name = "ConflictError";
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * Database error - 500
 * For database operations failures
 */
export class DatabaseError extends ApiError {
  originalError?: Error;

  constructor(
    message: string = "Database error",
    originalError?: Error,
    options?: {
      details?: Record<string, unknown>;
      path?: string;
      requestId?: string;
    },
  ) {
    super(ErrorCode.DATABASE_ERROR, message, 500, options);
    this.name = "DatabaseError";
    this.originalError = originalError;
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

/**
 * Service unavailable error - 503
 * For external service failures, database down, etc
 */
export class ServiceUnavailableError extends ApiError {
  constructor(
    message: string = "Service unavailable",
    options?: {
      details?: Record<string, unknown>;
      path?: string;
      requestId?: string;
    },
  ) {
    super(ErrorCode.SERVICE_UNAVAILABLE, message, 503, options);
    this.name = "ServiceUnavailableError";
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
  }
}

/**
 * Type guard for ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Type for error logger context
 */
export interface ErrorLogContext {
  statusCode: number;
  code: ErrorCode;
  message: string;
  path?: string;
  method?: string;
  requestId?: string;
  timestamp: string;
  isDevelopment: boolean;
  stack?: string;
  originalError?: Error;
}
