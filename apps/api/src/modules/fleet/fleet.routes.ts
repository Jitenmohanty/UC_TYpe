import { Prisma } from "@prisma/client";
import { Router } from "express";
import { driverInputSchema, vehicleInputSchema } from "@routewise/shared";
import { withTenant } from "../../db/prisma.js";
import { requireAuth, requireModule, requirePermission, requireTenantUser } from "../../http/auth.js";
import { audit, idParam, listQuerySchema, pageInfo } from "../common.js";

const vehicleSchema = vehicleInputSchema.partial();
const driverSchema = driverInputSchema.partial();

export const vehiclesRouter = Router();
vehiclesRouter.use(requireAuth, requireTenantUser, requireModule("fleet"));

vehiclesRouter.get("/", requirePermission("vehicle.view"), async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const where: Prisma.VehicleWhereInput = { deletedAt: null, ...(query.search ? { OR: [
      { registrationNo: { contains: query.search, mode: "insensitive" } }, { type: { contains: query.search, mode: "insensitive" } }
    ] } : {}) };
    const result = await withTenant(req.auth!.tenantId, async (tx) => {
      const [items, total] = await Promise.all([
        tx.vehicle.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: { registrationNo: "asc" }, include: { assignments: { where: { deletedAt: null, endAt: { gte: new Date() }, booking: { deletedAt: null, status: { not: "CANCELLED" } } }, include: { booking: { select: { serialNo: true, destination: true, startDate: true } }, driver: { select: { name: true, phone: true } } } } } }),
        tx.vehicle.count({ where })
      ]);
      return { items, total };
    });
    res.json({ ...result, ...pageInfo(query.page, query.pageSize, result.total) });
  } catch (error) { next(error); }
});

vehiclesRouter.post("/", requirePermission("vehicle.create"), async (req, res, next) => {
  try {
    const input = vehicleInputSchema.parse(req.body);
    const { tenantId, userId } = req.auth!;
    const vehicle = await withTenant(tenantId, async (tx) => {
      const created = await tx.vehicle.create({ data: { ...input, tenantId } });
      await audit(tx, req, { tenantId, actorId: userId, action: "vehicle.created", entityType: "vehicle", entityId: created.id, afterData: { registrationNo: created.registrationNo, type: created.type } });
      return created;
    });
    res.status(201).json(vehicle);
  } catch (error) { next(error); }
});

vehiclesRouter.patch("/:id", requirePermission("vehicle.update"), async (req, res, next) => {
  try {
    const input = vehicleSchema.parse(req.body);
    const { tenantId, userId } = req.auth!;
    const result = await withTenant(tenantId, async (tx) => {
      const before = await tx.vehicle.findFirst({ where: { id: idParam(req), deletedAt: null } });
      if (!before) return null;
      const updated = await tx.vehicle.update({ where: { id: before.id }, data: input });
      await audit(tx, req, { tenantId, actorId: userId, action: "vehicle.updated", entityType: "vehicle", entityId: before.id, beforeData: { registrationNo: before.registrationNo, type: before.type }, afterData: { registrationNo: updated.registrationNo, type: updated.type } });
      return updated;
    });
    if (!result) return res.status(404).json({ error: "Vehicle not found." });
    res.json(result);
  } catch (error) { next(error); }
});

vehiclesRouter.delete("/:id", requirePermission("vehicle.delete"), async (req, res, next) => {
  try {
    const { tenantId, userId } = req.auth!;
    const result = await withTenant(tenantId, async (tx) => {
      const vehicle = await tx.vehicle.findFirst({ where: { id: idParam(req), deletedAt: null } });
      if (!vehicle) return "missing" as const;
      const active = await tx.bookingAssignment.count({ where: { vehicleId: vehicle.id, deletedAt: null, endAt: { gte: new Date() }, booking: { deletedAt: null, status: { not: "CANCELLED" } } } });
      if (active) return "assigned" as const;
      await tx.vehicle.update({ where: { id: vehicle.id }, data: { deletedAt: new Date() } });
      await audit(tx, req, { tenantId, actorId: userId, action: "vehicle.deleted", entityType: "vehicle", entityId: vehicle.id, beforeData: { registrationNo: vehicle.registrationNo } });
      return "deleted" as const;
    });
    if (result === "missing") return res.status(404).json({ error: "Vehicle not found." });
    if (result === "assigned") return res.status(409).json({ error: "Vehicle has an active trip assignment." });
    res.status(204).end();
  } catch (error) { next(error); }
});

export const driversRouter = Router();
driversRouter.use(requireAuth, requireTenantUser, requireModule("fleet"));

driversRouter.get("/", requirePermission("driver.view"), async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const where: Prisma.DriverWhereInput = { deletedAt: null, ...(query.search ? { OR: [
      { name: { contains: query.search, mode: "insensitive" } }, { phone: { contains: query.search } }, { licenseNo: { contains: query.search, mode: "insensitive" } }
    ] } : {}) };
    const result = await withTenant(req.auth!.tenantId, async (tx) => {
      const [items, total] = await Promise.all([
        tx.driver.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: { name: "asc" }, include: { assignments: { where: { deletedAt: null, endAt: { gte: new Date() }, booking: { deletedAt: null, status: { not: "CANCELLED" } } }, include: { booking: { select: { serialNo: true, destination: true, startDate: true } }, vehicle: { select: { registrationNo: true, type: true } } } } } }),
        tx.driver.count({ where })
      ]);
      return { items, total };
    });
    res.json({ ...result, ...pageInfo(query.page, query.pageSize, result.total) });
  } catch (error) { next(error); }
});

driversRouter.post("/", requirePermission("driver.create"), async (req, res, next) => {
  try {
    const input = driverInputSchema.parse(req.body);
    const { tenantId, userId } = req.auth!;
    const driver = await withTenant(tenantId, async (tx) => {
      const created = await tx.driver.create({ data: { ...input, tenantId } });
      await audit(tx, req, { tenantId, actorId: userId, action: "driver.created", entityType: "driver", entityId: created.id, afterData: { name: created.name, licenseNo: created.licenseNo } });
      return created;
    });
    res.status(201).json(driver);
  } catch (error) { next(error); }
});

driversRouter.patch("/:id", requirePermission("driver.update"), async (req, res, next) => {
  try {
    const input = driverSchema.parse(req.body);
    const { tenantId, userId } = req.auth!;
    const result = await withTenant(tenantId, async (tx) => {
      const before = await tx.driver.findFirst({ where: { id: idParam(req), deletedAt: null } });
      if (!before) return null;
      const updated = await tx.driver.update({ where: { id: before.id }, data: input });
      await audit(tx, req, { tenantId, actorId: userId, action: "driver.updated", entityType: "driver", entityId: before.id, beforeData: { name: before.name, licenseNo: before.licenseNo }, afterData: { name: updated.name, licenseNo: updated.licenseNo } });
      return updated;
    });
    if (!result) return res.status(404).json({ error: "Driver not found." });
    res.json(result);
  } catch (error) { next(error); }
});

driversRouter.delete("/:id", requirePermission("driver.delete"), async (req, res, next) => {
  try {
    const { tenantId, userId } = req.auth!;
    const result = await withTenant(tenantId, async (tx) => {
      const driver = await tx.driver.findFirst({ where: { id: idParam(req), deletedAt: null } });
      if (!driver) return "missing" as const;
      const active = await tx.bookingAssignment.count({ where: { driverId: driver.id, deletedAt: null, endAt: { gte: new Date() }, booking: { deletedAt: null, status: { not: "CANCELLED" } } } });
      if (active) return "assigned" as const;
      await tx.driver.update({ where: { id: driver.id }, data: { deletedAt: new Date() } });
      await audit(tx, req, { tenantId, actorId: userId, action: "driver.deleted", entityType: "driver", entityId: driver.id, beforeData: { name: driver.name } });
      return "deleted" as const;
    });
    if (result === "missing") return res.status(404).json({ error: "Driver not found." });
    if (result === "assigned") return res.status(409).json({ error: "Driver has an active trip assignment." });
    res.status(204).end();
  } catch (error) { next(error); }
});
