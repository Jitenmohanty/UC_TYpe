import { Router, type Request } from "express";
import { Prisma, TripStatus } from "@prisma/client";
import { assignmentInputSchema, bookingQuerySchema, createBookingSchema, updateBookingSchema } from "@routewise/shared";
import { withTenant } from "../../db/prisma.js";
import { requireAuth, requireModule, requirePermission, requireTenantUser } from "../../http/auth.js";
import { idParam } from "../common.js";

export const bookingsRouter = Router();
bookingsRouter.use(requireAuth, requireTenantUser, requireModule("bookings"));
const canViewFinance = (req: Request) => req.auth?.role === "TENANT_ADMIN" || Boolean(req.auth?.permissions.includes("payment.view"));
function hideBookingFinance<T extends { totalAmount?: unknown; advanceAmount?: unknown }>(booking: T, req: Request) {
  if (canViewFinance(req)) return booking;
  const { totalAmount: _totalAmount, advanceAmount: _advanceAmount, ...safe } = booking;
  return safe;
}

bookingsRouter.get("/", requirePermission("booking.view"), async (req, res, next) => {
  try {
    const query = bookingQuerySchema.parse(req.query);
    const tenantId = req.auth!.tenantId;
    const where: Prisma.BookingWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status as TripStatus } : {}),
      ...(query.from || query.to ? { startDate: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } } : {}),
      ...(query.search ? { OR: [
        { serialNo: { contains: query.search, mode: "insensitive" } },
        { customerName: { contains: query.search, mode: "insensitive" } },
        { destination: { contains: query.search, mode: "insensitive" } }
      ] } : {})
    };
    const page = await withTenant(tenantId, async (tx) => {
      const [items, total] = await Promise.all([
        tx.booking.findMany({ where, include: { referencePerson: { select: { name: true, phone: true } }, payments: { where: { deletedAt: null, direction: "INBOUND" }, select: { amount: true } }, assignments: { where: { deletedAt: null }, include: { vehicle: true, driver: true } } }, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: { [query.sort]: query.direction } }),
        tx.booking.count({ where })
      ]);
      const rows = items.map((booking) => {
        const received = booking.payments.reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0));
        const { payments: _payments, ...fields } = booking;
        return canViewFinance(req) ? { ...fields, receivedAmount: received.toFixed(2) } : hideBookingFinance(fields, req);
      });
      return { items: rows, total };
    });
    res.json({ ...page, page: query.page, pageSize: query.pageSize, pageCount: Math.ceil(page.total / query.pageSize) });
  } catch (error) { next(error); }
});

bookingsRouter.post("/", requirePermission("booking.create"), async (req, res, next) => {
  try {
    const input = createBookingSchema.parse(req.body);
    const { tenantId, userId } = req.auth!;
    if (new Prisma.Decimal(input.advanceAmount).greaterThan(0) && req.auth!.role !== "TENANT_ADMIN" && !req.auth!.permissions.includes("payment.create")) {
      return res.status(403).json({ error: "Payment access is required to record an advance." });
    }
    const booking = await withTenant(tenantId, async (tx) => {
      if (input.customerId && !await tx.customer.findFirst({ where: { id: input.customerId, deletedAt: null }, select: { id: true } })) {
        res.status(400).json({ error: "Customer not found in this workspace." });
        return null;
      }
      let referencePersonId = input.referencePersonId ?? null;
      if (referencePersonId && !await tx.referencePerson.findFirst({ where: { id: referencePersonId, deletedAt: null }, select: { id: true } })) {
        res.status(400).json({ error: "Reference person not found in this workspace." });
        return null;
      }
      if (!referencePersonId && input.referencePersonName) {
        const existingReference = await tx.referencePerson.findFirst({ where: { name: { equals: input.referencePersonName, mode: "insensitive" }, deletedAt: null }, select: { id: true } });
        referencePersonId = existingReference?.id ?? (await tx.referencePerson.create({ data: { tenantId, name: input.referencePersonName } })).id;
      }
      const year = input.startDate.getUTCFullYear();
      const [counter] = await tx.$queryRaw<Array<{ value: number }>>`
        INSERT INTO tenant_counters (tenant_id, year, resource, value, updated_at)
        VALUES (${tenantId}::uuid, ${year}, 'booking', 1, now())
        ON CONFLICT (tenant_id, year, resource)
        DO UPDATE SET value = tenant_counters.value + 1, updated_at = now()
        RETURNING value
      `;
      const created = await tx.booking.create({ data: {
        tenantId,
        serialNo: `BK-${year}-${String(counter.value).padStart(4, "0")}`,
        customerId: input.customerId ?? null,
        referencePersonId,
        customerName: input.customerName,
        customerEmail: input.customerEmail || null,
        customerPhone: input.customerPhone,
        destination: input.destination,
        startDate: input.startDate,
        totalAmount: new Prisma.Decimal(input.totalAmount),
        advanceAmount: new Prisma.Decimal(input.advanceAmount),
        status: input.status,
        notes: input.notes || null,
        createdById: userId
      } });
      if (new Prisma.Decimal(input.advanceAmount).greaterThan(0)) {
        const payment = await tx.payment.create({ data: {
          tenantId, bookingId: created.id, direction: "INBOUND", amount: new Prisma.Decimal(input.advanceAmount),
          method: "ADVANCE", paidAt: new Date(), reference: created.serialNo
        } });
        await tx.auditLog.create({ data: { tenantId, actorId: userId, action: "payment.created", entityType: "payment", entityId: payment.id, afterData: { amount: input.advanceAmount, direction: "INBOUND", bookingId: created.id, method: "ADVANCE" }, ipAddress: req.ip } });
      }
      await tx.auditLog.create({ data: {
        tenantId, actorId: userId, action: "booking.created", entityType: "booking", entityId: created.id,
        afterData: { serialNo: created.serialNo, status: created.status, totalAmount: input.totalAmount }, ipAddress: req.ip
      } });
      return created;
    });
    if (booking) res.status(201).json(hideBookingFinance(booking, req));
  } catch (error) { next(error); }
});

bookingsRouter.get("/:id", requirePermission("booking.view"), async (req, res, next) => {
  try {
    const tenantId = req.auth!.tenantId;
    const booking = await withTenant(tenantId, (tx) => tx.booking.findFirst({
      where: { id: idParam(req), deletedAt: null },
      include: { referencePerson: true, assignments: { where: { deletedAt: null }, include: { vehicle: true, driver: true } } }
    }));
    if (!booking) return res.status(404).json({ error: "Booking not found." });
    if (!canViewFinance(req)) return res.json(hideBookingFinance(booking, req));
    const payments = await withTenant(tenantId, (tx) => tx.payment.findMany({ where: { bookingId: booking.id, deletedAt: null }, orderBy: { paidAt: "desc" } }));
    const receivedAmount = payments.filter((payment) => payment.direction === "INBOUND").reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0)).toFixed(2);
    res.json({ ...booking, receivedAmount, payments });
  } catch (error) { next(error); }
});

bookingsRouter.patch("/:id", requirePermission("booking.update"), async (req, res, next) => {
  try {
    const input = updateBookingSchema.parse(req.body);
    const { tenantId, userId } = req.auth!;
    if (input.totalAmount !== undefined && req.auth!.role !== "TENANT_ADMIN" && (!req.auth!.permissions.includes("payment.update") || !req.auth!.permissions.includes("payment.view"))) {
      return res.status(403).json({ error: "Payment view and update access are required to change a booking total." });
    }
    const booking = await withTenant(tenantId, async (tx) => {
      const before = await tx.booking.findFirst({ where: { id: idParam(req), deletedAt: null }, include: { referencePerson: true } });
      if (!before) return null;
      if (input.advanceAmount !== undefined && !new Prisma.Decimal(input.advanceAmount).equals(before.advanceAmount)) {
        res.status(400).json({ error: "Record an advance as a payment so the ledger stays accurate." });
        return null;
      }
      if (input.totalAmount !== undefined) {
        const received = await tx.payment.aggregate({ where: { bookingId: before.id, direction: "INBOUND", deletedAt: null }, _sum: { amount: true } });
        if (new Prisma.Decimal(input.totalAmount).lessThan(received._sum.amount ?? new Prisma.Decimal(0))) {
          res.status(409).json({ error: "Booking total cannot be less than payments already received." });
          return null;
        }
      }
      if (input.customerId && !await tx.customer.findFirst({ where: { id: input.customerId, deletedAt: null }, select: { id: true } })) {
        res.status(400).json({ error: "Customer not found in this workspace." });
        return null;
      }
      let referencePersonId = input.referencePersonId !== undefined ? input.referencePersonId : before.referencePersonId;
      if (input.referencePersonId && !await tx.referencePerson.findFirst({ where: { id: input.referencePersonId, deletedAt: null }, select: { id: true } })) {
        res.status(400).json({ error: "Reference person not found in this workspace." });
        return null;
      }
      if (input.referencePersonName !== undefined) {
        if (!input.referencePersonName) referencePersonId = null;
        else {
          const existingReference = await tx.referencePerson.findFirst({ where: { name: { equals: input.referencePersonName, mode: "insensitive" }, deletedAt: null }, select: { id: true } });
          referencePersonId = existingReference?.id ?? (await tx.referencePerson.create({ data: { tenantId, name: input.referencePersonName } })).id;
        }
      }
      const data: Prisma.BookingUncheckedUpdateInput = {};
      for (const key of ["customerName", "customerPhone", "destination", "status", "notes"] as const) if (input[key] !== undefined) data[key] = input[key];
      if (input.customerEmail !== undefined) data.customerEmail = input.customerEmail || null;
      if (input.customerId !== undefined) data.customerId = input.customerId;
      if (input.referencePersonId !== undefined || input.referencePersonName !== undefined) data.referencePersonId = referencePersonId;
      if (input.startDate !== undefined) data.startDate = input.startDate;
      if (input.totalAmount !== undefined) data.totalAmount = new Prisma.Decimal(input.totalAmount);
      if (input.advanceAmount !== undefined) data.advanceAmount = new Prisma.Decimal(input.advanceAmount);
      const updated = await tx.booking.update({ where: { id: before.id }, data });
      if (updated.status === "CANCELLED") await tx.bookingAssignment.updateMany({ where: { bookingId: updated.id, deletedAt: null }, data: { deletedAt: new Date() } });
      await tx.auditLog.create({ data: {
        tenantId, actorId: userId, action: "booking.updated", entityType: "booking", entityId: updated.id,
        beforeData: { status: before.status, totalAmount: before.totalAmount.toString(), startDate: before.startDate.toISOString() },
        afterData: { status: updated.status, totalAmount: updated.totalAmount.toString(), startDate: updated.startDate.toISOString() }, ipAddress: req.ip
      } });
      return updated;
    });
    if (res.headersSent) return;
    if (!booking) return res.status(404).json({ error: "Booking not found." });
    res.json(hideBookingFinance(booking, req));
  } catch (error) { next(error); }
});

bookingsRouter.delete("/:id", requirePermission("booking.delete"), async (req, res, next) => {
  try {
    const { tenantId, userId } = req.auth!;
    const deleted = await withTenant(tenantId, async (tx) => {
      const before = await tx.booking.findFirst({ where: { id: idParam(req), deletedAt: null } });
      if (!before) return null;
      const now = new Date();
      await tx.booking.update({ where: { id: before.id }, data: { deletedAt: now, status: "CANCELLED" } });
      await tx.bookingAssignment.updateMany({ where: { bookingId: before.id, deletedAt: null }, data: { deletedAt: now } });
      await tx.auditLog.create({ data: { tenantId, actorId: userId, action: "booking.deleted", entityType: "booking", entityId: before.id, beforeData: { status: before.status }, ipAddress: req.ip } });
      return true;
    });
    if (!deleted) return res.status(404).json({ error: "Booking not found." });
    res.status(204).end();
  } catch (error) { next(error); }
});

bookingsRouter.put("/:id/assignment", requireModule("fleet"), requirePermission("booking.update"), async (req, res, next) => {
  try {
    const input = assignmentInputSchema.parse(req.body);
    const { tenantId, userId } = req.auth!;
    if (input.vehicleId && req.auth!.role !== "TENANT_ADMIN" && !req.auth!.permissions.includes("vehicle.view")) return res.status(403).json({ error: "Vehicle access is required to assign a vehicle." });
    if (input.driverId && req.auth!.role !== "TENANT_ADMIN" && !req.auth!.permissions.includes("driver.view")) return res.status(403).json({ error: "Driver access is required to assign a driver." });
    const result = await withTenant(tenantId, async (tx) => {
      const booking = await tx.booking.findFirst({ where: { id: idParam(req), deletedAt: null, status: { not: "CANCELLED" } }, select: { id: true } });
      if (!booking) return { error: "booking" as const };
      if (input.vehicleId && !await tx.vehicle.findFirst({ where: { id: input.vehicleId, deletedAt: null }, select: { id: true } })) return { error: "vehicle" as const };
      if (input.driverId && !await tx.driver.findFirst({ where: { id: input.driverId, deletedAt: null }, select: { id: true } })) return { error: "driver" as const };
      const collision = await tx.bookingAssignment.findFirst({ where: {
        deletedAt: null, bookingId: { not: booking.id }, startAt: { lt: input.endAt }, endAt: { gt: input.startAt },
        OR: [
          ...(input.vehicleId ? [{ vehicleId: input.vehicleId }] : []),
          ...(input.driverId ? [{ driverId: input.driverId }] : [])
        ]
      }, select: { id: true, vehicleId: true, driverId: true } });
      if (collision) return { error: "conflict" as const };
      const existing = await tx.bookingAssignment.findFirst({ where: { bookingId: booking.id, deletedAt: null }, select: { id: true } });
      const assignment = existing
        ? await tx.bookingAssignment.update({ where: { id: existing.id }, data: { vehicleId: input.vehicleId ?? null, driverId: input.driverId ?? null, startAt: input.startAt, endAt: input.endAt } })
        : await tx.bookingAssignment.create({ data: { tenantId, bookingId: booking.id, vehicleId: input.vehicleId ?? null, driverId: input.driverId ?? null, startAt: input.startAt, endAt: input.endAt } });
      await tx.auditLog.create({ data: { tenantId, actorId: userId, action: "booking.assignment.updated", entityType: "booking", entityId: booking.id, afterData: { vehicleId: input.vehicleId ?? null, driverId: input.driverId ?? null, startAt: input.startAt.toISOString(), endAt: input.endAt.toISOString() }, ipAddress: req.ip } });
      return { assignment };
    });
    if ("error" in result) {
      if (result.error === "booking") return res.status(404).json({ error: "Active booking not found." });
      if (result.error === "vehicle" || result.error === "driver") return res.status(400).json({ error: `Selected ${result.error} not found in this workspace.` });
      return res.status(409).json({ error: "The selected vehicle or driver is already assigned during this time." });
    }
    res.json(result.assignment);
  } catch (error) { next(error); }
});
