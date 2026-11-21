import type { Prisma } from "@prisma/client";
import type { Tx } from "./db";

export function audit(tx: Tx, actorId: string | null, action: string, target?: { type: string; id: string }, details?: Prisma.InputJsonValue) {
  return tx.auditLog.create({
    data: { actorId, action, targetType: target?.type, targetId: target?.id, details },
  });
}
