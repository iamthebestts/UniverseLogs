import { logger } from "@/core/logger";
import { serialize } from "../utils/serialization";

type UniverseId = bigint;

/**
 * Interface para representar o socket do Elysia de forma segura.
 */
export interface WSLike {
  send(data: any): void;
  close(): void; // Simplificado conforme feedback
  data: {
    universeId?: UniverseId;
    [key: string]: unknown;
  };
}

class WebSocketManager {
  private tenants = new Map<UniverseId, Set<WSLike>>();

  add(universeId: UniverseId, ws: WSLike) {
    ws.data.universeId = universeId;

    if (!this.tenants.has(universeId)) {
      this.tenants.set(universeId, new Set());
    }

    this.tenants.get(universeId)!.add(ws);
    logger.debug(
      `[ws-manager] Universe ${universeId}: Client joined. Total: ${this.tenants.get(universeId)!.size}`,
    );
  }

  remove(ws: WSLike) {
    const universeId = ws.data.universeId;
    if (!universeId) return;

    const group = this.tenants.get(universeId);
    if (!group) return;

    group.delete(ws);

    if (group.size === 0) {
      this.tenants.delete(universeId);
    }
    logger.debug(`[ws-manager] Universe ${universeId}: Client left.`);
  }

  broadcast(universeId: UniverseId, payload: unknown) {
    const group = this.tenants.get(universeId);
    if (!group || group.size === 0) return;

    const data = serialize(payload);

    for (const ws of group) {
      try {
        ws.send(data);
      } catch (error) {
        logger.error(`[ws-manager] Broadcast failed for a client in universe ${universeId}`, {
          error,
        });
      }
    }
  }
}

export const wsManager = new WebSocketManager();
