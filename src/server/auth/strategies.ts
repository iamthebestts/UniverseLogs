/**
 * Authentication strategies: API Key and Master Key
 */

import { validateApiKey } from "@/services/api-keys.service";
import { env } from "@/env";
import type { AuthContext, AuthResult, AuthStrategy } from "./types";

class ApiKeyStrategy implements AuthStrategy {
  keyHeaderName = "x-api-key";

  async validate(ctx: AuthContext): Promise<AuthResult> {
    const key = this.extractKey(ctx.headers);
    if (!key) {
      return { valid: false, error: "Missing API key" };
    }

    const isValid = await validateApiKey(key);
    if (!isValid) {
      return { valid: false, error: "Invalid API key" };
    }

    return { valid: true };
  }

  private extractKey(headers: Record<string, string | string[] | undefined>): string | undefined {
    const value = headers["x-api-key"];
    if (!value) return undefined;
    return Array.isArray(value) ? value[0] : value;
  }
}

class MasterKeyStrategy implements AuthStrategy {
  keyHeaderName = "x-master-key";

  validate(ctx: AuthContext): AuthResult {
    const key = this.extractKey(ctx.headers);
    const masterKey = env.MASTER_KEY ?? "";

    if (!key || key !== masterKey) {
      return { valid: false, error: "Invalid master key" };
    }

    return { valid: true };
  }

  private extractKey(headers: Record<string, string | string[] | undefined>): string | undefined {
    const value = headers["x-master-key"];
    if (!value) return undefined;
    return Array.isArray(value) ? value[0] : value;
  }
}

/**
 * Get auth strategy by type
 */
export const getAuthStrategy = (type: "api" | "internal"): AuthStrategy => {
  return type === "internal" ? new MasterKeyStrategy() : new ApiKeyStrategy();
};
