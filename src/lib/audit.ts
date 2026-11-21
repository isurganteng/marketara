import { db } from '../db';
import { auditLogs } from '../db/schema';
import { env } from '../config';

interface AuditInput {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** Audit tidak boleh menggagalkan transaksi bisnis utama. */
export async function writeAuditLog(input: AuditInput): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      oldValues: input.oldValues ?? null,
      newValues: input.newValues ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });
  } catch (error) {
    if (!env.isProduction) console.error('[audit] failed to write log', error);
  }
}
