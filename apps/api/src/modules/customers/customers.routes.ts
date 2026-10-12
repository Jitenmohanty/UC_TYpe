import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { withTenant } from "../../db/prisma.js";
import { requireAuth, requireModule, requirePermission, requireTenantUser } from "../../http/auth.js";
import { audit, idParam, listQuerySchema, pageInfo } from "../common.js";

const customerInput = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254).optional().or(z.literal("")),
  phone: z.string().trim().min(7).max(30),
  company: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(4000).optional()
});

export const customersRouter = Router();
customersRouter.use(requireAuth, requireTenantUser, requireModule("customers"));

customersRouter.get("/", requirePermission("customer.view"), async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const where: Prisma.CustomerWhereInput = { deletedAt: null, ...(query.search ? { OR: [
      { name: { contains: query.search, mode: "insensitive" } },
      { email: { contains: query.search, mode: "insensitive" } },
      { phone: { contains: query.search } },
      { company: { contains: query.search, mode: "insensitive" } }
    ] } : {}) };
    const result = await withTenant(req.auth!.tenantId, async (tx) => {
      const [items, total] = await Promise.all([
        tx.customer.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: { name: "asc" }, include: { _count: { select: { bookings: true } } } }),
        tx.customer.count({ where })
      ]);
      return { items, total };
    });
    res.json({ ...result, ...pageInfo(query.page, query.pageSize, result.total) });
  } catch (error) { next(error); }
});

customersRouter.post("/", requirePermission("customer.create"), async (req, res, next) => {
  try {
    const input = customerInput.parse(req.body);
    const { tenantId, userId } = req.auth!;
    const customer = await withTenant(tenantId, async (tx) => {
      const created = await tx.customer.create({ data: { tenantId, ...input, email: input.email || null } });
      await audit(tx, req, { tenantId, actorId: userId, action: "customer.created", entityType: "customer", entityId: created.id, afterData: { name: created.name } });
      return created;
    });
    res.status(201).json(customer);
  } catch (error) { next(error); }
});

customersRouter.patch("/:id", requirePermission("customer.update"), async (req, res, next) => {
  try {
    const input = customerInput.partial().parse(req.body);
    const { tenantId, userId } = req.auth!;
    const result = await withTenant(tenantId, async (tx) => {
      const before = await tx.customer.findFirst({ where: { id: idParam(req), deletedAt: null } });
      if (!before) return null;
      const updated = await tx.customer.update({ where: { id: before.id }, data: { ...input, ...(input.email !== undefined ? { email: input.email || null } : {}) } });
      await audit(tx, req, { tenantId, actorId: userId, action: "customer.updated", entityType: "customer", entityId: updated.id, beforeData: { name: before.name }, afterData: { name: updated.name } });
      return updated;
    });
    if (!result) return res.status(404).json({ error: "Customer not found." });
    res.json(result);
  } catch (error) { next(error); }
});

customersRouter.delete("/:id", requirePermission("customer.delete"), async (req, res, next) => {
  try {
    const { tenantId, userId } = req.auth!;
    const result = await withTenant(tenantId, async (tx) => {
      const customer = await tx.customer.findFirst({ where: { id: idParam(req), deletedAt: null } });
      if (!customer) return false;
      await tx.customer.update({ where: { id: customer.id }, data: { deletedAt: new Date() } });
      await audit(tx, req, { tenantId, actorId: userId, action: "customer.deleted", entityType: "customer", entityId: customer.id, beforeData: { name: customer.name } });
      return true;
    });
    if (!result) return res.status(404).json({ error: "Customer not found." });
    res.status(204).end();
  } catch (error) { next(error); }
});
