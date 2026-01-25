import { vi } from "vitest";

export const mockApiKeysService = {
  validateApiKey: vi.fn(),
  revokeKey: vi.fn(),
  createApiKey: vi.fn(),
  getIdByKey: vi.fn(),
  listApiKeys: vi.fn(),
  countActiveApiKeys: vi.fn().mockResolvedValue(0),
};
