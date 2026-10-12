import argon2 from "argon2";
import { Router } from "express";
import { z } from "zod";
import { permissionKeys, tenantProvisionSchema } from "@routewise/shared";
import { prisma, withTenant } from "../../db/prisma.js";
import { requireAuth, requireRole } from "../../http/auth.js";
import { audit, idParam } from "../common.js";

export const platformRouter = Router();
platformRouter.use(requireAuth, requireRole("SUPER_ADMIN"));

const moduleCatalog = [
  ["bookings", "Bookings"], ["fleet", "Fleet"], ["accounts", "Accounts"],
  ["customers", "Customers"], ["reports", "Reports"]
] as const;

platformRouter.get("/modules", async (_req, res, next) => {
  try {
    const modules = await prisma.module.findMany({ orderBy: { name: "asc" } });
    res.json({ items: modules });
  } catch (error) { next(error); }
});

platformRouter.get("/tenants", async (_req, res, next) => {
  try {
    const tenants = await prisma.tenant.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" } });
    const rows = await Promise.all(tenants.map(async (tenant) => {
      const [modules, userCount] = await withTenant(tenant.id, (tx) => Promise.all([
        tx.tenantModule.findMany({ include: { module: { select: { key: true, name: true } } } }),
        tx.user.count({ where: { deletedAt: null } })
      ]));
      return { id: tenant.id, name: tenant.name, slug: tenant.slug, planKey: tenant.planKey, currency: tenant.currency, suspendedAt: tenant.suspendedAt, createdAt: tenant.createdAt, userCount, modules: modules.map((item) => ({ ...item.module, enabled: item.enabled })) };
    }));
    res.json({ items: rows });
  } catch (error) { next(error); }
});

platformRouter.post("/tenants", async (req, res, next) => {
  try {
    const input = tenantProvisionSchema.parse(req.body);
    const allowedModules = input.modules ?? moduleCatalog.map(([key]) => key);
    if (allowedModules.some((key) => !moduleCatalog.some(([known]) => key === known))) return res.status(400).json({ error: "One or more modules are invalid." });
    const passwordHash = await argon2.hash(input.adminPassword, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.tenant.findUnique({ where: { slug: input.slug }, select: { id: true } });
      if (existing) return { error: "slug" as const };
      const tenant = await tx.tenant.create({ data: {
        name: input.name, slug: input.slug, planKey: input.planKey, currency: input.currency.toUpperCase(),
        settings: { invoicePrefix: input.slug.replaceAll("-", "").slice(0, 4).toUpperCase() }
      } });
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenant.id}, true)`;
      const roleAdmin = await tx.role.create({ data: { tenantId: tenant.id, key: "TENANT_ADMIN", name: "Workspace admin" } });
      const roleEmployee = await tx.role.create({ data: { tenantId: tenant.id, key: "DISPATCHER", name: "Dispatcher" } });
      const permissions = await Promise.all(permissionKeys.map((key) => tx.permission.upsert({
        where: { key }, create: { key, description: key.replaceAll(".", " ") }, update: {}
      })));
      await tx.rolePermission.createMany({ data: permissions.map((permission) => ({ tenantId: tenant.id, roleId: roleAdmin.id, permissionId: permission.id })) });
      const employeePermissionKeys = new Set(["dashboard.view", "booking.view", "booking.create", "booking.update", "customer.view", "customer.create", "customer.update", "vehicle.view", "driver.view"]);
      await tx.rolePermission.createMany({ data: permissions.filter((permission) => employeePermissionKeys.has(permission.key)).map((permission) => ({ tenantId: tenant.id, roleId: roleEmployee.id, permissionId: permission.id })) });
      const modules = await Promise.all(moduleCatalog.filter(([key]) => allowedModules.includes(key)).map(([key, name]) => tx.module.upsert({ where: { key }, create: { key, name }, update: { name } })));
      await tx.tenantModule.createMany({ data: modules.map((module) => ({ tenantId: tenant.id, moduleId: module.id, enabled: true })) });
      const admin = await tx.user.create({ data: {
        tenantId: tenant.id, roleId: roleAdmin.id, email: input.adminEmail.toLowerCase(), name: input.adminName,
        passwordHash, roleKey: "TENANT_ADMIN", emailVerifiedAt: new Date()
      }, select: { id: true, email: true, name: true, roleKey: true } });
      await tx.auditLog.create({ data: { tenantId: tenant.id, actorId: req.auth!.userId, action: "tenant.onboarded", entityType: "tenant", entityId: tenant.id, afterData: { name: tenant.name, slug: tenant.slug, planKey: tenant.planKey, adminEmail: admin.email }, ipAddress: req.ip } });
      return { tenant, admin, modules };
    });
    if (result.error === "slug") return res.status(409).json({ error: "That workspace URL is already in use." });
    res.status(201).json({ tenant: { id: result.tenant.id, name: result.tenant.name, slug: result.tenant.slug, planKey: result.tenant.planKey, currency: result.tenant.currency }, admin: result.admin, modules: result.modules.map(({ key, name }) => ({ key, name, enabled: true })) });
  } catch (error) { next(error); }
});

platformRouter.patch("/tenants/:id", async (req, res, next) => {
  try {
    const input = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]).optional(), planKey: z.string().trim().min(2).max(40).optional() }).refine((value) => Object.keys(value).length > 0).parse(req.body);
    const tenantId = idParam(req);
    const before = await prisma.tenant.findFirst({ where: { id: tenantId, deletedAt: null } });
    if (!before) return res.status(404).json({ error: "Workspace not found." });
    const updated = await prisma.tenant.update({ where: { id: before.id }, data: {
      ...(input.planKey ? { planKey: input.planKey } : {}),
      ...(input.status ? { suspendedAt: input.status === "SUSPENDED" ? new Date() : null } : {})
    } });
    await withTenant(updated.id, async (tx) => {
      if (input.status === "SUSPENDED") await tx.refreshToken.updateMany({ where: { revokedAt: null }, data: { revokedAt: new Date() } });
      await audit(tx, req, { tenantId: updated.id, actorId: req.auth!.userId, action: "tenant.updated", entityType: "tenant", entityId: updated.id, beforeData: { planKey: before.planKey, suspendedAt: before.suspendedAt?.toISOString() ?? null }, afterData: { planKey: updated.planKey, suspendedAt: updated.suspendedAt?.toISOString() ?? null } });
    });
    res.json({ id: updated.id, name: updated.name, slug: updated.slug, planKey: updated.planKey, suspendedAt: updated.suspendedAt });
  } catch (error) { next(error); }
});

platformRouter.put("/tenants/:id/modules/:key", async (req, res, next) => {
  try {
    const input = z.object({ enabled: z.boolean() }).parse(req.body);
    const key = z.string().min(2).max(60).parse(req.params.key);
    const tenant = await prisma.tenant.findFirst({ where: { id: idParam(req), deletedAt: null }, select: { id: true } });
    const module = await prisma.module.findUnique({ where: { key } });
    if (!tenant || !module) return res.status(404).json({ error: "Workspace or module not found." });
    const setting = await withTenant(tenant.id, async (tx) => {
      const updated = await tx.tenantModule.upsert({
        where: { tenantId_moduleId: { tenantId: tenant.id, moduleId: module.id } },
        create: { tenantId: tenant.id, moduleId: module.id, enabled: input.enabled },
        update: { enabled: input.enabled }
      });
      await audit(tx, req, { tenantId: tenant.id, actorId: req.auth!.userId, action: "tenant.module.updated", entityType: "tenant_module", entityId: module.id, afterData: { key, enabled: updated.enabled } });
      return updated;
    });
    res.json({ key, enabled: setting.enabled });
  } catch (error) { next(error); }
});
