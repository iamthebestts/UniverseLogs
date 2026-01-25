/**
 * Auth strategy types and interfaces for modular authentication
 */

export type AuthType = "api" | "internal";

export interface AuthContext {
  headers: Record<string, string | string[] | undefined>;
  type: AuthType;
}

export interface AuthResult {
  valid: boolean;
  error?: string;
  universeId?: bigint;
}

export interface AuthStrategy {
  validate(ctx: AuthContext): Promise<AuthResult> | AuthResult;
  keyHeaderName: string;
}
