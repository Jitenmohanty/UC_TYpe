import argon2 from "argon2";
import { Router } from "express";
import { employeeInputSchema, permissionKeys, roleInputSchema } from "@routewise/shared";
import { withTenant } from "../../db/prisma.js";
import { requireAuth, requirePermission, requireTenantUser } from "../../http/auth.js";
import { audit, idParam } from "../common.js";

export const teamRouter = Router();
teamRouter.use(requireAuth, requireTenantUser);

teamRouter.get("/permissions", requirePermission("role.manage"), (_req, res) => {
  res.json({ items: permissionKeys });
});

teamRouter.get("/roles", requirePermission("role.manage"), async (req, res, next) => {
  try {
    const roles = await withTenant(req.auth!.tenantId, (tx) => tx.role.findMany({
      where: { deletedAt: null }, orderBy: { name: "asc" },
      include: { permissions: { include: { permission: { select: { key: true, description: true } } } }, _count: { select: { users: true } } }
    }));
    res.json({ items: roles.map((role) => ({
      id: role.id, key: role.key, name: role.name, isSystem: role.key === "TENANT_ADMIN",
      permissions: role.permissions.map((entry) => entry.permission.key), userCount: role._count.users
    })) });
  } catch (error) { next(error); }
});

teamRouter.post("/roles", requirePermission("role.manage"), async (req, res, next) => {
  try {
    const input = roleInputSchema.parse(req.body);
    if (input.key === "tenant_admin") return res.status(400).json({ error: "The tenant admin role is reserved." });
    const { tenantId, userId } = req.auth!;
    const result = await withTenant(tenantId, async (tx) => {
      const available = await tx.permission.findMany({ where: { key: { in: input.permissions } }, select: { id: true, key: true } });
      if (available.length !== new Set(input.permissions).size) return { error: "permissions" as const };
      const role = await tx.role.create({ data: { tenantId, key: input.key, name: input.name } });
      if (available.length) await tx.rolePermission.createMany({ data: available.map((permission) => ({ tenantId, roleId: role.id, permissionId: permission.id })) });
      await audit(tx, req, { tenantId, actorId: userId, action: "role.created", entityType: "role", entityId: role.id, afterData: { key: role.key, name: role.name, permissions: input.permissions } });
      return { role };
    });
    if ("error" in result) return res.status(400).json({ error: "One or more permission keys are invalid." });
    res.status(201).json({ id: result.role.id, key: result.role.key, name: result.role.name, permissions: input.permissions });
  } catch (error) { next(error); }
});

teamRouter.put("/roles/:id", requirePermission("role.manage"), async (req, res, next) => {
  try {
    const input = roleInputSchema.parse(req.body);
    if (input.key === "tenant_admin") return res.status(400).json({ error: "The tenant admin role is reserved." });
    const { tenantId, userId } = req.auth!;
    const result = await withTenant(tenantId, async (tx) => {
      const before = await tx.role.findFirst({ where: { id: idParam(req), deletedAt: null } });
      if (!before) return { error: "missing" as const };
      if (before.key === "TENANT_ADMIN") return { error: "reserved" as const };
      const available = await tx.permission.findMany({ where: { key: { in: input.permissions } }, select: { id: true, key: true } });
      if (available.length !== new Set(input.permissions).size) return { error: "permissions" as const };
      const role = await tx.role.update({ where: { id: before.id }, data: { key: input.key, name: input.name } });
      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      if (available.length) await tx.rolePermission.createMany({ data: available.map((permission) => ({ tenantId, roleId: role.id, permissionId: permission.id })) });
      await audit(tx, req, { tenantId, actorId: userId, action: "role.updated", entityType: "role", entityId: role.id, beforeData: { key: before.key, name: before.name }, afterData: { key: role.key, name: role.name, permissions: input.permissions } });
      return { role };
    });
    if (result.error === "missing") return res.status(404).json({ error: "Role not found." });
    if (result.error === "reserved") return res.status(403).json({ error: "The tenant admin role cannot be changed." });
    if (result.error === "permissions") return res.status(400).json({ error: "One or more permission keys are invalid." });
    res.json({ id: result.role.id, key: result.role.key, name: result.role.name, permissions: input.permissions });
  } catch (error) { next(error); }
});

teamRouter.get("/employees", requirePermission("employee.manage"), async (req, res, next) => {
  try {
    const employees = await withTenant(req.auth!.tenantId, (tx) => tx.user.findMany({
      where: { roleKey: "EMPLOYEE", deletedAt: null }, orderBy: { name: "asc" },
      select: { id: true, email: true, name: true, createdAt: true, role: { select: { id: true, key: true, name: true, permissions: { select: { permission: { select: { key: true } } } } } } }
    }));
    res.json({ items: employees.map((employee) => ({
      id: employee.id, email: employee.email, name: employee.name, createdAt: employee.createdAt,
      role: employee.role ? { id: employee.role.id, key: employee.role.key, name: employee.role.name, permissions: employee.role.permissions.map(({ permission }) => permission.key) } : null
    })) });
  } catch (error) { next(error); }
});

teamRouter.post("/employees", requirePermission("employee.manage"), async (req, res, next) => {
  try {
    const input = employeeInputSchema.parse(req.body);
    const { tenantId, userId } = req.auth!;
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
    const result = await withTenant(tenantId, async (tx) => {
      const role = await tx.role.findFirst({ where: { id: input.roleId, deletedAt: null } });
      if (!role || role.key === "TENANT_ADMIN") return { error: "role" as const };
      const duplicate = await tx.user.findFirst({ where: { email: input.email, deletedAt: null }, select: { id: true } });
      if (duplicate) return { error: "duplicate" as const };
      const employee = await tx.user.create({ data: { tenantId, roleId: role.id, email: input.email, name: input.name, passwordHash, roleKey: "EMPLOYEE" }, select: { id: true, email: true, name: true, createdAt: true } });
      await audit(tx, req, { tenantId, actorId: userId, action: "employee.created", entityType: "user", entityId: employee.id, afterData: { email: employee.email, name: employee.name, role: role.key } });
      return { employee, role };
    });
    if (result.error === "role") return res.status(400).json({ error: "Choose an employee role from this workspace." });
    if (result.error === "duplicate") return res.status(409).json({ error: "An active user with this email already exists in this workspace." });
    res.status(201).json({ ...result.employee, role: { id: result.role.id, key: result.role.key, name: result.role.name } });
  } catch (error) { next(error); }
});

teamRouter.patch("/employees/:id", requirePermission("employee.manage"), async (req, res, next) => {
  try {
    const input = employeeInputSchema.pick({ name: true, roleId: true }).partial().refine((value) => Object.keys(value).length > 0).parse(req.body);
    const { tenantId, userId } = req.auth!;
    const result = await withTenant(tenantId, async (tx) => {
      const before = await tx.user.findFirst({ where: { id: idParam(req), roleKey: "EMPLOYEE", deletedAt: null } });
      if (!before) return { error: "missing" as const };
      if (input.roleId) {
        const role = await tx.role.findFirst({ where: { id: input.roleId, deletedAt: null } });
        if (!role || role.key === "TENANT_ADMIN") return { error: "role" as const };
      }
      const employee = await tx.user.update({ where: { id: before.id }, data: { ...(input.name ? { name: input.name } : {}), ...(input.roleId ? { roleId: input.roleId } : {}) }, select: { id: true, email: true, name: true, role: { select: { id: true, key: true, name: true } } } });
      await audit(tx, req, { tenantId, actorId: userId, action: "employee.updated", entityType: "user", entityId: employee.id, beforeData: { name: before.name }, afterData: { name: employee.name, role: employee.role?.key } });
      return { employee };
    });
    if (result.error === "missing") return res.status(404).json({ error: "Employee not found." });
    if (result.error === "role") return res.status(400).json({ error: "Choose an employee role from this workspace." });
    res.json(result.employee);
  } catch (error) { next(error); }
});

teamRouter.delete("/employees/:id", requirePermission("employee.manage"), async (req, res, next) => {
  try {
    const { tenantId, userId } = req.auth!;
    const deleted = await withTenant(tenantId, async (tx) => {
      const employee = await tx.user.findFirst({ where: { id: idParam(req), roleKey: "EMPLOYEE", deletedAt: null } });
      if (!employee) return false;
      const now = new Date();
      await tx.user.update({ where: { id: employee.id }, data: { deletedAt: now } });
      await tx.refreshToken.updateMany({ where: { userId: employee.id, revokedAt: null }, data: { revokedAt: now } });
      await audit(tx, req, { tenantId, actorId: userId, action: "employee.deleted", entityType: "user", entityId: employee.id, beforeData: { email: employee.email } });
      return true;
    });
    if (!deleted) return res.status(404).json({ error: "Employee not found." });
    res.status(204).end();
  } catch (error) { next(error); }
});
