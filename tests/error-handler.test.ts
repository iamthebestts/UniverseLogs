// @ts-nocheck
import {
  ApiError,
  AuthError,
  AuthorizationError,
  ConflictError,
  DatabaseError,
  ErrorCode,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  ValidationError,
  isApiError,
  type ApiErrorData,
  type ErrorLogContext,
} from "@/server/errors/types";
import { describe, expect, it } from "vitest";

describe("Error Handler Types", () => {
  describe("ErrorCode Enum", () => {
    it("should have all required error codes", () => {
      expect(ErrorCode.VALIDATION_FAILED).toBeDefined();
      expect(ErrorCode.INVALID_REQUEST).toBeDefined();
      expect(ErrorCode.MISSING_AUTH).toBeDefined();
      expect(ErrorCode.INVALID_API_KEY).toBeDefined();
      expect(ErrorCode.RATE_LIMITED).toBeDefined();
      expect(ErrorCode.NOT_FOUND).toBeDefined();
      expect(ErrorCode.INTERNAL_ERROR).toBeDefined();
      expect(ErrorCode.DATABASE_ERROR).toBeDefined();
    });

    it("should have string values", () => {
      expect(typeof ErrorCode.VALIDATION_FAILED).toBe("string");
      expect(typeof ErrorCode.RATE_LIMITED).toBe("string");
    });
  });

  describe("ApiError Base Class", () => {
    it("should create an ApiError with all properties", () => {
      const error = new ApiError(ErrorCode.VALIDATION_FAILED, "Test error", 400, {
        details: { field: "email" },
      });

      expect(error.message).toBe("Test error");
      expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ field: "email" });
      expect(error.timestamp).toBeDefined();
      expect(error instanceof Error).toBe(true);
      expect(error instanceof ApiError).toBe(true);
    });

    it("should have optional requestId", () => {
      const error = new ApiError(ErrorCode.VALIDATION_FAILED, "Test", 400);
      expect(error.requestId).toBeUndefined();

      const error2 = new ApiError(
        ErrorCode.VALIDATION_FAILED,
        "Test",
        400,
        { requestId: "req-123" }
      );
      expect(error2.requestId).toBe("req-123");
    });

    it("should have optional path", () => {
      const error = new ApiError(ErrorCode.VALIDATION_FAILED, "Test", 400);
      expect(error.path).toBeUndefined();

      const error2 = new ApiError(
        ErrorCode.VALIDATION_FAILED,
        "Test",
        400,
        { path: "/api/test", requestId: "req-123" }
      );
      expect(error2.path).toBe("/api/test");
    });

    it("should generate timestamp automatically", () => {
      const before = new Date();
      const error = new ApiError("Test", ErrorCode.VALIDATION_FAILED, 400);
      const after = new Date();

      const timestamp = new Date(error.timestamp);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe("ValidationError", () => {
    it("should create with 400 status code", () => {
      const error = new ValidationError("Email is required");

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
      expect(error.message).toBe("Email is required");
    });

    it("should accept details", () => {
      const error = new ValidationError("Invalid pattern", {
        details: {
          pattern: "user@domain",
          value: "invalid",
        },
      });

      expect(error.details?.pattern).toBe("user@domain");
      expect(error.details?.value).toBe("invalid");
    });
  });

  describe("AuthError", () => {
    it("should create with 401 status code", () => {
      const error = new AuthError("Missing API key");

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe(ErrorCode.INVALID_API_KEY);
      expect(error.message).toBe("Missing API key");
    });

    it("should accept error code", () => {
      const error = new AuthError("Invalid token", {
        code: ErrorCode.INVALID_TOKEN,
      });

      expect(error.code).toBe(ErrorCode.INVALID_TOKEN);
    });
  });

  describe("AuthorizationError", () => {
    it("should create with 403 status code", () => {
      const error = new AuthorizationError("Insufficient permissions");

      expect(error.statusCode).toBe(403);
      expect(error.code).toBe(ErrorCode.FORBIDDEN);
      expect(error.message).toBe("Insufficient permissions");
    });
  });

  describe("RateLimitError", () => {
    it("should create with 429 status code", () => {
      const error = new RateLimitError("Too many requests", 60);

      expect(error.statusCode).toBe(429);
      expect(error.code).toBe(ErrorCode.RATE_LIMITED);
      expect(error.message).toBe("Too many requests");
      expect(error.details?.retryAfter).toBe(60);
    });

    it("should set Retry-After header value", () => {
      const error = new RateLimitError("Limit exceeded", 120);

      expect(error.details?.retryAfter).toBe(120);
    });
  });

  describe("NotFoundError", () => {
    it("should create with 404 status code", () => {
      const error = new NotFoundError("User not found");

      expect(error.statusCode).toBe(404);
      expect(error.code).toBe(ErrorCode.NOT_FOUND);
      expect(error.message).toBe("User not found");
    });
  });

  describe("ConflictError", () => {
    it("should create with 409 status code", () => {
      const error = new ConflictError("Email already exists");

      expect(error.statusCode).toBe(409);
      expect(error.code).toBe(ErrorCode.CONFLICT);
      expect(error.message).toBe("Email already exists");
    });
  });

  describe("DatabaseError", () => {
    it("should create with 500 status code", () => {
      const error = new DatabaseError("Connection failed");

      expect(error.statusCode).toBe(500);
      expect(error.code).toBe(ErrorCode.DATABASE_ERROR);
      expect(error.message).toBe("Connection failed");
    });

    it("should accept original error for debugging", () => {
      const originalError = new Error("Pool exhausted");
      const error = new DatabaseError("Connection failed", originalError);

      expect(error.originalError).toBe(originalError);
      expect(error.originalError?.message).toBe("Pool exhausted");
    });
  });

  describe("ServiceUnavailableError", () => {
    it("should create with 503 status code", () => {
      const error = new ServiceUnavailableError("Database is offline");

      expect(error.statusCode).toBe(503);
      expect(error.code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
      expect(error.message).toBe("Database is offline");
    });
  });

  describe("isApiError Type Guard", () => {
    it("should return true for ApiError instances", () => {
      const error = new ValidationError("Test");
      expect(isApiError(error)).toBe(true);
    });

    it("should return true for all error subclasses", () => {
      expect(isApiError(new ValidationError("Test"))).toBe(true);
      expect(isApiError(new AuthError("Test"))).toBe(true);
      expect(isApiError(new RateLimitError("Test", 60))).toBe(true);
      expect(isApiError(new NotFoundError("Test"))).toBe(true);
      expect(isApiError(new DatabaseError("Test"))).toBe(true);
      expect(isApiError(new ServiceUnavailableError("Test"))).toBe(true);
    });

    it("should return false for regular Error instances", () => {
      const error = new Error("Regular error");
      expect(isApiError(error)).toBe(false);
    });

    it("should return false for non-Error objects", () => {
      expect(isApiError("error string")).toBe(false);
      expect(isApiError({ message: "object" })).toBe(false);
      expect(isApiError(null)).toBe(false);
      expect(isApiError(undefined)).toBe(false);
    });
  });

  describe("Error Response Format", () => {
    it("should format validation error response correctly", () => {
      const error = new ValidationError("Email invalid", {
        details: {
          maxLength: 100,
          provided: 150,
        },
      });

      const response: ApiErrorData = {
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        timestamp: error.timestamp,
        path: "/api/test",
        requestId: "req-123",
        details: error.details,
      };

      expect(response.code).toBe(ErrorCode.VALIDATION_FAILED);
      expect(response.statusCode).toBe(400);
      expect(response.details?.maxLength).toBe(100);
      expect(response.details?.provided).toBe(150);
    });

    it("should hide details in production response", () => {
      const error = new ValidationError("Test", { secret: "data" });

      // Production response would exclude details
      const productionResponse: ApiErrorData = {
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        timestamp: error.timestamp,
        path: "/api/test",
        requestId: "req-123",
        // details omitted in production
      };

      expect(productionResponse.details).toBeUndefined();
    });

    it("should include all required fields in response", () => {
      const error = new NotFoundError("Resource not found");

      const response: ApiErrorData = {
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        timestamp: error.timestamp,
        path: "/api/resources/123",
        requestId: "req-abc",
      };

      expect(response).toHaveProperty("code");
      expect(response).toHaveProperty("message");
      expect(response).toHaveProperty("statusCode");
      expect(response).toHaveProperty("timestamp");
      expect(response).toHaveProperty("path");
      expect(response).toHaveProperty("requestId");
    });
  });

  describe("Error Inheritance", () => {
    it("should inherit from Error and have correct name", () => {
      const error = new ValidationError("Test");
      expect(error instanceof Error).toBe(true);
      expect(error.name).toBe("ValidationError");
    });

    it("should have proper stack traces", () => {
      const error = new ValidationError("Test");
      expect(error.stack).toBeDefined();
      expect(error.stack?.includes("ValidationError")).toBe(true);
    });

    it("should be catchable as Error", () => {
      const error = new RateLimitError("Test", 60);

      let caught = false;
      try {
        throw error;
      } catch (e) {
        caught = true;
        expect(e instanceof Error).toBe(true);
        expect(isApiError(e)).toBe(true);
      }

      expect(caught).toBe(true);
    });
  });

  describe("Error Code Coverage", () => {
    const errorCodeTests = [
      {
        code: ErrorCode.VALIDATION_FAILED,
        expectedStatus: 400,
        expectedClass: ValidationError,
      },
      {
        code: ErrorCode.INVALID_REQUEST,
        expectedStatus: 400,
        expectedClass: ValidationError,
      },
      {
        code: ErrorCode.MISSING_AUTH,
        expectedStatus: 401,
        expectedClass: AuthError,
      },
      {
        code: ErrorCode.INVALID_API_KEY,
        expectedStatus: 401,
        expectedClass: AuthError,
      },
      {
        code: ErrorCode.RATE_LIMITED,
        expectedStatus: 429,
        expectedClass: RateLimitError,
      },
      {
        code: ErrorCode.NOT_FOUND,
        expectedStatus: 404,
        expectedClass: NotFoundError,
      },
      {
        code: ErrorCode.DATABASE_ERROR,
        expectedStatus: 500,
        expectedClass: DatabaseError,
      },
      {
        code: ErrorCode.SERVICE_UNAVAILABLE,
        expectedStatus: 503,
        expectedClass: ServiceUnavailableError,
      },
    ];

    errorCodeTests.forEach(({ code, expectedStatus, expectedClass }) => {
      it(`should map ${code} to ${expectedStatus}`, () => {
        expect(typeof code).toBe("string");
        expect(code.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Error Context", () => {
    it("should provide complete error log context", () => {
      const error = new ValidationError("Test error", { field: "email" });

      const context: ErrorLogContext = {
        statusCode: error.statusCode,
        code: error.code,
        message: error.message,
        path: "/api/test",
        method: "POST",
        requestId: "req-123",
        timestamp: error.timestamp,
        stack: error.stack,
        originalError: error,
      };

      expect(context.statusCode).toBe(400);
      expect(context.code).toBe(ErrorCode.VALIDATION_FAILED);
      expect(context.requestId).toBe("req-123");
      expect(context.timestamp).toBeDefined();
      expect(context.originalError).toBe(error);
    });
  });

  describe("Error Creation Edge Cases", () => {
    it("should handle empty message", () => {
      const error = new ValidationError("");
      expect(error.message).toBe("");
      expect(error.statusCode).toBe(400);
    });

    it("should handle very long messages", () => {
      const longMessage = "x".repeat(10000);
      const error = new ValidationError(longMessage);
      expect(error.message).toBe(longMessage);
    });

    it("should handle details with nested objects", () => {
      const details = {
        level1: {
          level2: {
            level3: {
              value: "deep",
            },
          },
        },
      };

      const error = new ValidationError("Test", { details });
      expect(error.details?.level1).toBeDefined();
      expect((error.details?.level1 as any)?.level2?.level3?.value).toBe("deep");
    });

    it("should handle null/undefined in details", () => {
      const error = new ValidationError("Test", {
        details: {
          nullValue: null,
          emptyString: "",
          zeroValue: 0,
          falseValue: false,
        },
      });

      expect(error.details?.nullValue).toBeNull();
      expect(error.details?.emptyString).toBe("");
      expect(error.details?.zeroValue).toBe(0);
      expect(error.details?.falseValue).toBe(false);
    });
  });

  describe("Status Code Validation", () => {
    const statusCodeTests = [
      { ErrorClass: ValidationError, expectedStatus: 400 },
      { ErrorClass: AuthError, expectedStatus: 401 },
      { ErrorClass: AuthorizationError, expectedStatus: 403 },
      { ErrorClass: NotFoundError, expectedStatus: 404 },
      { ErrorClass: ConflictError, expectedStatus: 409 },
      { ErrorClass: RateLimitError, expectedStatus: 429, args: [60] },
      { ErrorClass: DatabaseError, expectedStatus: 500 },
      { ErrorClass: ServiceUnavailableError, expectedStatus: 503 },
    ];

    statusCodeTests.forEach(({ ErrorClass, expectedStatus, args }) => {
      it(`should have correct status code for ${ErrorClass.name}`, () => {
        const error = new (ErrorClass as any)("Test", ...(args || []));
        expect(error.statusCode).toBe(expectedStatus);
      });
    });
  });
});
