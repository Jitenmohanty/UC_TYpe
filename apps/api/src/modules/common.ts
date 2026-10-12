import { Prisma } from "@prisma/client";
import type { Request } from "express";
import { z } from "zod";

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(120).optional()
});

export function idParam(req: Request, key = "id") {
  return z.string().uuid().parse(req.params[key]);
}

export async function audit(
  tx: Prisma.TransactionClient,
  req: Request,
  input: { tenantId: string; actorId: string; action: string; entityType: string; entityId?: string | null; beforeData?: Record<string, unknown>; afterData?: Record<string, unknown> }
) {
  await tx.auditLog.create({ data: {
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    beforeData: input.beforeData as Prisma.InputJsonValue | undefined,
    afterData: input.afterData as Prisma.InputJsonValue | undefined,
    ipAddress: req.ip
  } });
}

export function pageInfo(page: number, pageSize: number, total: number) {
  return { page, pageSize, total, pageCount: Math.ceil(total / pageSize) };
}
