import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { commissionInputSchema, expenseInputSchema, invoiceInputSchema, paymentInputSchema, receiptInputSchema, vendorInputSchema } from "@routewise/shared";
import { withTenant } from "../../db/prisma.js";
import { requireAuth, requireModule, requirePermission, requireTenantUser } from "../../http/auth.js";
import { audit, idParam, listQuerySchema, pageInfo } from "../common.js";

export const vendorsRouter = Router();
vendorsRouter.use(requireAuth, requireTenantUser, requireModule("accounts"));

vendorsRouter.get("/", requirePermission("vendor.view"), async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const where: Prisma.VendorWhereInput = { deletedAt: null, ...(query.search ? { OR: [
      { name: { contains: query.search, mode: "insensitive" } }, { serviceType: { contains: query.search, mode: "insensitive" } }, { phone: { contains: query.search } }
    ] } : {}) };
    const result = await withTenant(req.auth!.tenantId, async (tx) => {
      const [items, total] = await Promise.all([
        tx.vendor.findMany({ where, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: { name: "asc" } }),
        tx.vendor.count({ where })
      ]);
      return { items, total };
    });
    res.json({ ...result, ...pageInfo(query.page, query.pageSize, result.total) });
  } catch (error) { next(error); }
});

vendorsRouter.post("/", requirePermission("vendor.create"), async (req, res, next) => {
  try {
    const input = vendorInputSchema.parse(req.body);
    const { tenantId, userId } = req.auth!;
    const vendor = await withTenant(tenantId, async (tx) => {
      const created = await tx.vendor.create({ data: { tenantId, ...input, phone: input.phone ?? null, email: input.email ?? null, serviceType: input.serviceType ?? null } });
      await audit(tx, req, { tenantId, actorId: userId, action: "vendor.created", entityType: "vendor", entityId: created.id, afterData: { name: created.name } });
      return created;
    });
    res.status(201).json(vendor);
  } catch (error) { next(error); }
});

vendorsRouter.patch("/:id", requirePermission("vendor.update"), async (req, res, next) => {
  try {
    const input = vendorInputSchema.partial().parse(req.body);
    const { tenantId, userId } = req.auth!;
    const result = await withTenant(tenantId, async (tx) => {
      const before = await tx.vendor.findFirst({ where: { id: idParam(req), deletedAt: null } });
      if (!before) return null;
      const updated = await tx.vendor.update({ where: { id: before.id }, data: input });
      await audit(tx, req, { tenantId, actorId: userId, action: "vendor.updated", entityType: "vendor", entityId: updated.id, beforeData: { name: before.name }, afterData: { name: updated.name } });
      return updated;
    });
    if (!result) return res.status(404).json({ error: "Vendor not found." });
    res.json(result);
  } catch (error) { next(error); }
});

vendorsRouter.delete("/:id", requirePermission("vendor.delete"), async (req, res, next) => {
  try {
    const { tenantId, userId } = req.auth!;
    const deleted = await withTenant(tenantId, async (tx) => {
      const vendor = await tx.vendor.findFirst({ where: { id: idParam(req), deletedAt: null } });
      if (!vendor) return false;
      const [expenseCount, paymentCount] = await Promise.all([
        tx.expense.count({ where: { vendorId: vendor.id, deletedAt: null } }),
        tx.payment.count({ where: { vendorId: vendor.id, deletedAt: null } })
      ]);
      if (expenseCount || paymentCount) return "history" as const;
      await tx.vendor.update({ where: { id: vendor.id }, data: { deletedAt: new Date() } });
      await audit(tx, req, { tenantId, actorId: userId, action: "vendor.deleted", entityType: "vendor", entityId: vendor.id, beforeData: { name: vendor.name } });
      return "deleted" as const;
    });
    if (!deleted) return res.status(404).json({ error: "Vendor not found." });
    if (deleted === "history") return res.status(409).json({ error: "A vendor with payment or expense history cannot be deleted." });
    res.status(204).end();
  } catch (error) { next(error); }
});

export const accountsRouter = Router();
accountsRouter.use(requireAuth, requireTenantUser, requireModule("accounts"));

accountsRouter.get("/payments", requirePermission("payment.view"), async (req, res, next) => {
  try {
    const query = listQuerySchema.extend({ from: z.coerce.date().optional(), to: z.coerce.date().optional(), direction: z.enum(["INBOUND", "OUTBOUND"]).optional() }).parse(req.query);
    const where: Prisma.PaymentWhereInput = {
      deletedAt: null,
      ...(query.from || query.to ? { paidAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } } : {}),
      ...(query.direction ? { direction: query.direction } : {}),
      ...(query.search ? { OR: [{ reference: { contains: query.search, mode: "insensitive" } }, { booking: { serialNo: { contains: query.search, mode: "insensitive" } } }, { vendor: { name: { contains: query.search, mode: "insensitive" } } }] } : {})
    };
    const result = await withTenant(req.auth!.tenantId, async (tx) => {
      const [items, total] = await Promise.all([
        tx.payment.findMany({ where, include: { booking: { select: { serialNo: true, customerName: true } }, vendor: { select: { name: true } } }, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: { paidAt: "desc" } }),
        tx.payment.count({ where })
      ]);
      return { items, total };
    });
    res.json({ ...result, ...pageInfo(query.page, query.pageSize, result.total) });
  } catch (error) { next(error); }
});

accountsRouter.post("/payments", requirePermission("payment.create"), async (req, res, next) => {
  try {
    const input = paymentInputSchema.parse(req.body);
    if (input.direction === "INBOUND" && !input.bookingId) return res.status(400).json({ error: "An incoming payment must be linked to a booking." });
    if (input.direction === "OUTBOUND" && !input.vendorId) return res.status(400).json({ error: "A vendor payment must be linked to a vendor." });
    const { tenantId, userId } = req.auth!;
    const result = await withTenant(tenantId, async (tx) => {
      if (input.bookingId) {
        const booking = await tx.booking.findFirst({ where: { id: input.bookingId, deletedAt: null }, select: { id: true, totalAmount: true } });
        if (!booking) return { error: "booking" as const };
        if (input.direction === "INBOUND") {
          const prior = await tx.payment.aggregate({ where: { bookingId: booking.id, direction: "INBOUND", deletedAt: null }, _sum: { amount: true } });
          if ((prior._sum.amount ?? new Prisma.Decimal(0)).plus(input.amount).greaterThan(booking.totalAmount)) return { error: "overpayment" as const };
        }
      }
      if (input.vendorId && !await tx.vendor.findFirst({ where: { id: input.vendorId, deletedAt: null }, select: { id: true } })) return { error: "vendor" as const };
      const payment = await tx.payment.create({ data: { tenantId, bookingId: input.bookingId ?? null, vendorId: input.vendorId ?? null, amount: new Prisma.Decimal(input.amount), direction: input.direction, method: input.method ?? null, reference: input.reference ?? null, paidAt: input.paidAt } });
      await audit(tx, req, { tenantId, actorId: userId, action: "payment.created", entityType: "payment", entityId: payment.id, afterData: { amount: input.amount, direction: input.direction, bookingId: input.bookingId ?? null, vendorId: input.vendorId ?? null } });
      return { payment };
    });
    if ("error" in result) {
      if (result.error === "booking" || result.error === "vendor") return res.status(400).json({ error: `Selected ${result.error} not found in this workspace.` });
      return res.status(409).json({ error: "The payment would exceed the booking balance." });
    }
    res.status(201).json(result.payment);
  } catch (error) { next(error); }
});

accountsRouter.patch("/payments/:id", requirePermission("payment.update"), async (req, res, next) => {
  try {
    const input = paymentInputSchema.partial().parse(req.body);
    const { tenantId, userId } = req.auth!;
    const result = await withTenant(tenantId, async (tx) => {
      const before = await tx.payment.findFirst({ where: { id: idParam(req), deletedAt: null } });
      if (!before) return { error: "missing" as const };
      const direction = input.direction ?? before.direction;
      const bookingId = input.bookingId ?? before.bookingId;
      const vendorId = input.vendorId ?? before.vendorId;
      if (direction === "INBOUND" && (!bookingId || vendorId)) return { error: "link" as const };
      if (direction === "OUTBOUND" && (!vendorId || bookingId)) return { error: "link" as const };
      if (bookingId && !await tx.booking.findFirst({ where: { id: bookingId, deletedAt: null }, select: { id: true, totalAmount: true } })) return { error: "booking" as const };
      if (vendorId && !await tx.vendor.findFirst({ where: { id: vendorId, deletedAt: null }, select: { id: true } })) return { error: "vendor" as const };
      if (direction === "INBOUND" && bookingId && input.amount !== undefined) {
        const booking = await tx.booking.findFirst({ where: { id: bookingId, deletedAt: null }, select: { totalAmount: true } });
        const other = await tx.payment.aggregate({ where: { bookingId, direction: "INBOUND", deletedAt: null, id: { not: before.id } }, _sum: { amount: true } });
        if ((other._sum.amount ?? new Prisma.Decimal(0)).plus(input.amount).greaterThan(booking!.totalAmount)) return { error: "overpayment" as const };
      }
      const updated = await tx.payment.update({ where: { id: before.id }, data: { ...input, ...(input.amount !== undefined ? { amount: new Prisma.Decimal(input.amount) } : {}) } });
      await audit(tx, req, { tenantId, actorId: userId, action: "payment.updated", entityType: "payment", entityId: updated.id, beforeData: { amount: before.amount.toString(), direction: before.direction }, afterData: { amount: updated.amount.toString(), direction: updated.direction } });
      return { payment: updated };
    });
    if ("error" in result) {
      if (result.error === "missing") return res.status(404).json({ error: "Payment not found." });
      if (result.error === "link") return res.status(400).json({ error: "Incoming payments require only a booking; vendor payouts require only a vendor." });
      if (result.error === "booking" || result.error === "vendor") return res.status(400).json({ error: `Selected ${result.error} not found in this workspace.` });
      return res.status(409).json({ error: "The payment would exceed the booking balance." });
    }
    res.json(result.payment);
  } catch (error) { next(error); }
});

accountsRouter.delete("/payments/:id", requirePermission("payment.delete"), async (req, res, next) => {
  try {
    const { tenantId, userId } = req.auth!;
    const deleted = await withTenant(tenantId, async (tx) => {
      const payment = await tx.payment.findFirst({ where: { id: idParam(req), deletedAt: null } });
      if (!payment) return false;
      await tx.payment.update({ where: { id: payment.id }, data: { deletedAt: new Date() } });
      await audit(tx, req, { tenantId, actorId: userId, action: "payment.deleted", entityType: "payment", entityId: payment.id, beforeData: { amount: payment.amount.toString(), direction: payment.direction } });
      return true;
    });
    if (!deleted) return res.status(404).json({ error: "Payment not found." });
    res.status(204).end();
  } catch (error) { next(error); }
});

accountsRouter.get("/expenses", requirePermission("expense.view"), async (req, res, next) => {
  try {
    const query = listQuerySchema.extend({ from: z.coerce.date().optional(), to: z.coerce.date().optional() }).parse(req.query);
    const where: Prisma.ExpenseWhereInput = { deletedAt: null, ...(query.from || query.to ? { incurredAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } } : {}), ...(query.search ? { OR: [{ category: { contains: query.search, mode: "insensitive" } }, { description: { contains: query.search, mode: "insensitive" } }] } : {}) };
    const result = await withTenant(req.auth!.tenantId, async (tx) => {
      const [items, total] = await Promise.all([tx.expense.findMany({ where, include: { vendor: { select: { name: true } } }, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: { incurredAt: "desc" } }), tx.expense.count({ where })]);
      return { items, total };
    });
    res.json({ ...result, ...pageInfo(query.page, query.pageSize, result.total) });
  } catch (error) { next(error); }
});

accountsRouter.post("/expenses", requirePermission("expense.create"), async (req, res, next) => {
  try {
    const input = expenseInputSchema.parse(req.body);
    const { tenantId, userId } = req.auth!;
    const result = await withTenant(tenantId, async (tx) => {
      if (input.vendorId && !await tx.vendor.findFirst({ where: { id: input.vendorId, deletedAt: null }, select: { id: true } })) return null;
      const expense = await tx.expense.create({ data: { tenantId, vendorId: input.vendorId ?? null, category: input.category, description: input.description ?? null, amount: new Prisma.Decimal(input.amount), incurredAt: input.incurredAt } });
      await audit(tx, req, { tenantId, actorId: userId, action: "expense.created", entityType: "expense", entityId: expense.id, afterData: { category: expense.category, amount: input.amount, vendorId: expense.vendorId } });
      return expense;
    });
    if (!result) return res.status(400).json({ error: "Vendor not found in this workspace." });
    res.status(201).json(result);
  } catch (error) { next(error); }
});

accountsRouter.patch("/expenses/:id", requirePermission("expense.update"), async (req, res, next) => {
  try {
    const input = expenseInputSchema.partial().parse(req.body);
    const { tenantId, userId } = req.auth!;
    const result = await withTenant(tenantId, async (tx) => {
      const before = await tx.expense.findFirst({ where: { id: idParam(req), deletedAt: null } });
      if (!before) return null;
      if (input.vendorId && !await tx.vendor.findFirst({ where: { id: input.vendorId, deletedAt: null }, select: { id: true } })) return "vendor" as const;
      const updated = await tx.expense.update({ where: { id: before.id }, data: { ...input, ...(input.amount !== undefined ? { amount: new Prisma.Decimal(input.amount) } : {}) } });
      await audit(tx, req, { tenantId, actorId: userId, action: "expense.updated", entityType: "expense", entityId: updated.id, beforeData: { amount: before.amount.toString(), category: before.category }, afterData: { amount: updated.amount.toString(), category: updated.category } });
      return updated;
    });
    if (!result) return res.status(404).json({ error: "Expense not found." });
    if (result === "vendor") return res.status(400).json({ error: "Vendor not found in this workspace." });
    res.json(result);
  } catch (error) { next(error); }
});

accountsRouter.delete("/expenses/:id", requirePermission("expense.delete"), async (req, res, next) => {
  try {
    const { tenantId, userId } = req.auth!;
    const deleted = await withTenant(tenantId, async (tx) => {
      const expense = await tx.expense.findFirst({ where: { id: idParam(req), deletedAt: null } });
      if (!expense) return false;
      await tx.expense.update({ where: { id: expense.id }, data: { deletedAt: new Date() } });
      await audit(tx, req, { tenantId, actorId: userId, action: "expense.deleted", entityType: "expense", entityId: expense.id, beforeData: { amount: expense.amount.toString(), category: expense.category } });
      return true;
    });
    if (!deleted) return res.status(404).json({ error: "Expense not found." });
    res.status(204).end();
  } catch (error) { next(error); }
});

accountsRouter.get("/commissions", requirePermission("commission.view"), async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const result = await withTenant(req.auth!.tenantId, async (tx) => {
      const [items, total] = await Promise.all([tx.commission.findMany({ where: { deletedAt: null }, include: { booking: { select: { serialNo: true, customerName: true } } }, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: { createdAt: "desc" } }), tx.commission.count({ where: { deletedAt: null } })]);
      return { items, total };
    });
    res.json({ ...result, ...pageInfo(query.page, query.pageSize, result.total) });
  } catch (error) { next(error); }
});

accountsRouter.post("/commissions", requirePermission("commission.create"), async (req, res, next) => {
  try {
    const input = commissionInputSchema.parse(req.body);
    const { tenantId, userId } = req.auth!;
    const result = await withTenant(tenantId, async (tx) => {
      if (!await tx.booking.findFirst({ where: { id: input.bookingId, deletedAt: null }, select: { id: true } })) return null;
      const commission = await tx.commission.create({ data: { tenantId, bookingId: input.bookingId, amount: new Prisma.Decimal(input.amount), payeeName: input.payeeName ?? null } });
      await audit(tx, req, { tenantId, actorId: userId, action: "commission.created", entityType: "commission", entityId: commission.id, afterData: { bookingId: commission.bookingId, amount: input.amount } });
      return commission;
    });
    if (!result) return res.status(400).json({ error: "Booking not found in this workspace." });
    res.status(201).json(result);
  } catch (error) { next(error); }
});

accountsRouter.patch("/commissions/:id", requirePermission("commission.update"), async (req, res, next) => {
  try {
    const input = commissionInputSchema.pick({ amount: true, payeeName: true }).partial().parse(req.body);
    const { tenantId, userId } = req.auth!;
    const result = await withTenant(tenantId, async (tx) => {
      const before = await tx.commission.findFirst({ where: { id: idParam(req), deletedAt: null } });
      if (!before) return null;
      const updated = await tx.commission.update({ where: { id: before.id }, data: { ...input, ...(input.amount !== undefined ? { amount: new Prisma.Decimal(input.amount) } : {}) } });
      await audit(tx, req, { tenantId, actorId: userId, action: "commission.updated", entityType: "commission", entityId: updated.id, beforeData: { amount: before.amount.toString() }, afterData: { amount: updated.amount.toString() } });
      return updated;
    });
    if (!result) return res.status(404).json({ error: "Commission not found." });
    res.json(result);
  } catch (error) { next(error); }
});

accountsRouter.delete("/commissions/:id", requirePermission("commission.delete"), async (req, res, next) => {
  try {
    const { tenantId, userId } = req.auth!;
    const deleted = await withTenant(tenantId, async (tx) => {
      const commission = await tx.commission.findFirst({ where: { id: idParam(req), deletedAt: null } });
      if (!commission) return false;
      await tx.commission.update({ where: { id: commission.id }, data: { deletedAt: new Date() } });
      await audit(tx, req, { tenantId, actorId: userId, action: "commission.deleted", entityType: "commission", entityId: commission.id, beforeData: { amount: commission.amount.toString(), bookingId: commission.bookingId } });
      return true;
    });
    if (!deleted) return res.status(404).json({ error: "Commission not found." });
    res.status(204).end();
  } catch (error) { next(error); }
});

accountsRouter.get("/invoices", requirePermission("invoice.view"), async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const result = await withTenant(req.auth!.tenantId, async (tx) => {
      const where = { deletedAt: null, ...(query.search ? { OR: [{ number: { contains: query.search, mode: "insensitive" as const } }, { booking: { serialNo: { contains: query.search, mode: "insensitive" as const } } }] } : {}) };
      const [items, total] = await Promise.all([tx.invoice.findMany({ where, include: { booking: { select: { serialNo: true, customerName: true, customerEmail: true } } }, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: { issuedAt: "desc" } }), tx.invoice.count({ where })]);
      return { items, total };
    });
    res.json({ ...result, ...pageInfo(query.page, query.pageSize, result.total) });
  } catch (error) { next(error); }
});

accountsRouter.post("/invoices", requirePermission("invoice.create"), async (req, res, next) => {
  try {
    const input = invoiceInputSchema.parse(req.body);
    const { tenantId, userId } = req.auth!;
    const result = await withTenant(tenantId, async (tx) => {
      const booking = await tx.booking.findFirst({ where: { id: input.bookingId, deletedAt: null }, select: { id: true, startDate: true } });
      if (!booking) return null;
      const [counter] = await tx.$queryRaw<Array<{ value: number }>>`
        INSERT INTO tenant_counters (tenant_id, year, resource, value, updated_at) VALUES (${tenantId}::uuid, ${input.issuedAt.getUTCFullYear()}, 'invoice', 1, now())
        ON CONFLICT (tenant_id, year, resource) DO UPDATE SET value = tenant_counters.value + 1, updated_at = now() RETURNING value
      `;
      const invoice = await tx.invoice.create({ data: { tenantId, bookingId: booking.id, number: `INV-${input.issuedAt.getUTCFullYear()}-${String(counter.value).padStart(4, "0")}`, total: new Prisma.Decimal(input.total), issuedAt: input.issuedAt, dueAt: input.dueAt ?? null } });
      await audit(tx, req, { tenantId, actorId: userId, action: "invoice.created", entityType: "invoice", entityId: invoice.id, afterData: { number: invoice.number, total: input.total, bookingId: booking.id } });
      return invoice;
    });
    if (!result) return res.status(400).json({ error: "Booking not found in this workspace." });
    res.status(201).json(result);
  } catch (error) { next(error); }
});

accountsRouter.patch("/invoices/:id", requirePermission("invoice.update"), async (req, res, next) => {
  try {
    const input = invoiceInputSchema.pick({ total: true, issuedAt: true, dueAt: true }).partial().parse(req.body);
    const { tenantId, userId } = req.auth!;
    const result = await withTenant(tenantId, async (tx) => {
      const before = await tx.invoice.findFirst({ where: { id: idParam(req), deletedAt: null } });
      if (!before) return null;
      if (input.total !== undefined) {
        const receipts = await tx.receipt.aggregate({ where: { invoiceId: before.id, deletedAt: null }, _sum: { amount: true } });
        if ((receipts._sum.amount ?? new Prisma.Decimal(0)).greaterThan(input.total)) return "receipts" as const;
      }
      const updated = await tx.invoice.update({ where: { id: before.id }, data: { ...input, ...(input.total !== undefined ? { total: new Prisma.Decimal(input.total) } : {}) } });
      await audit(tx, req, { tenantId, actorId: userId, action: "invoice.updated", entityType: "invoice", entityId: updated.id, beforeData: { total: before.total.toString() }, afterData: { total: updated.total.toString() } });
      return updated;
    });
    if (!result) return res.status(404).json({ error: "Invoice not found." });
    if (result === "receipts") return res.status(409).json({ error: "Invoice total cannot be lower than receipts already issued." });
    res.json(result);
  } catch (error) { next(error); }
});

accountsRouter.delete("/invoices/:id", requirePermission("invoice.delete"), async (req, res, next) => {
  try {
    const { tenantId, userId } = req.auth!;
    const deleted = await withTenant(tenantId, async (tx) => {
      const invoice = await tx.invoice.findFirst({ where: { id: idParam(req), deletedAt: null } });
      if (!invoice) return false;
      await tx.invoice.update({ where: { id: invoice.id }, data: { deletedAt: new Date() } });
      await audit(tx, req, { tenantId, actorId: userId, action: "invoice.deleted", entityType: "invoice", entityId: invoice.id, beforeData: { number: invoice.number, total: invoice.total.toString() } });
      return true;
    });
    if (!deleted) return res.status(404).json({ error: "Invoice not found." });
    res.status(204).end();
  } catch (error) { next(error); }
});

accountsRouter.get("/receipts", requirePermission("receipt.view"), async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const result = await withTenant(req.auth!.tenantId, async (tx) => {
      const where = query.search ? { number: { contains: query.search, mode: "insensitive" as const } } : {};
      const receiptWhere = { ...where, deletedAt: null };
      const [items, total] = await Promise.all([tx.receipt.findMany({ where: receiptWhere, include: { invoice: { select: { number: true } } }, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: { issuedAt: "desc" } }), tx.receipt.count({ where: receiptWhere })]);
      return { items, total };
    });
    res.json({ ...result, ...pageInfo(query.page, query.pageSize, result.total) });
  } catch (error) { next(error); }
});

accountsRouter.post("/receipts", requirePermission("receipt.create"), async (req, res, next) => {
  try {
    const input = receiptInputSchema.parse(req.body);
    if (!input.invoiceId && !input.paymentId) return res.status(400).json({ error: "Link the receipt to an invoice or payment." });
    const { tenantId, userId } = req.auth!;
    const result = await withTenant(tenantId, async (tx) => {
      const invoice = input.invoiceId ? await tx.invoice.findFirst({ where: { id: input.invoiceId, deletedAt: null }, select: { id: true, total: true, bookingId: true } }) : null;
      if (input.invoiceId && !invoice) return { error: "invoice" as const };
      const payment = input.paymentId ? await tx.payment.findFirst({ where: { id: input.paymentId, deletedAt: null }, select: { id: true, amount: true, direction: true, bookingId: true } }) : null;
      if (input.paymentId && !payment) return { error: "payment" as const };
      if (payment && (payment.direction !== "INBOUND" || !payment.bookingId)) return { error: "payment" as const };
      if (payment && invoice && payment.bookingId !== invoice.bookingId) return { error: "link" as const };
      const amount = new Prisma.Decimal(input.amount);
      if (invoice) {
        const previous = await tx.receipt.aggregate({ where: { invoiceId: invoice.id, deletedAt: null }, _sum: { amount: true } });
        if ((previous._sum.amount ?? new Prisma.Decimal(0)).plus(amount).greaterThan(invoice.total)) return { error: "amount" as const };
      }
      if (payment) {
        const previous = await tx.receipt.aggregate({ where: { paymentId: payment.id, deletedAt: null }, _sum: { amount: true } });
        if ((previous._sum.amount ?? new Prisma.Decimal(0)).plus(amount).greaterThan(payment.amount)) return { error: "amount" as const };
      }
      const [counter] = await tx.$queryRaw<Array<{ value: number }>>`
        INSERT INTO tenant_counters (tenant_id, year, resource, value, updated_at) VALUES (${tenantId}::uuid, ${input.issuedAt.getUTCFullYear()}, 'receipt', 1, now())
        ON CONFLICT (tenant_id, year, resource) DO UPDATE SET value = tenant_counters.value + 1, updated_at = now() RETURNING value
      `;
      const receipt = await tx.receipt.create({ data: { tenantId, invoiceId: input.invoiceId ?? null, paymentId: input.paymentId ?? null, number: `RCT-${input.issuedAt.getUTCFullYear()}-${String(counter.value).padStart(4, "0")}`, amount, issuedAt: input.issuedAt } });
      await audit(tx, req, { tenantId, actorId: userId, action: "receipt.created", entityType: "receipt", entityId: receipt.id, afterData: { number: receipt.number, amount: input.amount } });
      return { receipt };
    });
    if ("error" in result) {
      if (result.error === "invoice" || result.error === "payment") return res.status(400).json({ error: `Selected ${result.error} not found in this workspace.` });
      if (result.error === "link") return res.status(400).json({ error: "The receipt invoice and payment must belong to the same booking." });
      return res.status(409).json({ error: "The receipt amount exceeds the remaining invoice or payment balance." });
    }
    res.status(201).json(result.receipt);
  } catch (error) { next(error); }
});

accountsRouter.patch("/receipts/:id", requirePermission("receipt.update"), async (req, res, next) => {
  try {
    const input = receiptInputSchema.pick({ amount: true, issuedAt: true }).partial().parse(req.body);
    const { tenantId, userId } = req.auth!;
    const result = await withTenant(tenantId, async (tx) => {
      const before = await tx.receipt.findFirst({ where: { id: idParam(req), deletedAt: null } });
      if (!before) return null;
      if (input.amount !== undefined) {
        if (before.invoiceId) {
          const invoice = await tx.invoice.findFirst({ where: { id: before.invoiceId, deletedAt: null }, select: { total: true } });
          const previous = await tx.receipt.aggregate({ where: { invoiceId: before.invoiceId, deletedAt: null, id: { not: before.id } }, _sum: { amount: true } });
          if (invoice && (previous._sum.amount ?? new Prisma.Decimal(0)).plus(input.amount).greaterThan(invoice.total)) return "invoice" as const;
        }
        if (before.paymentId) {
          const payment = await tx.payment.findFirst({ where: { id: before.paymentId, deletedAt: null }, select: { amount: true } });
          const previous = await tx.receipt.aggregate({ where: { paymentId: before.paymentId, deletedAt: null, id: { not: before.id } }, _sum: { amount: true } });
          if (payment && (previous._sum.amount ?? new Prisma.Decimal(0)).plus(input.amount).greaterThan(payment.amount)) return "payment" as const;
        }
      }
      const updated = await tx.receipt.update({ where: { id: before.id }, data: { ...input, ...(input.amount !== undefined ? { amount: new Prisma.Decimal(input.amount) } : {}) } });
      await audit(tx, req, { tenantId, actorId: userId, action: "receipt.updated", entityType: "receipt", entityId: updated.id, beforeData: { amount: before.amount.toString() }, afterData: { amount: updated.amount.toString() } });
      return updated;
    });
    if (!result) return res.status(404).json({ error: "Receipt not found." });
    if (result === "invoice" || result === "payment") return res.status(409).json({ error: `Receipt amount exceeds the remaining ${result} balance.` });
    res.json(result);
  } catch (error) { next(error); }
});

accountsRouter.delete("/receipts/:id", requirePermission("receipt.delete"), async (req, res, next) => {
  try {
    const { tenantId, userId } = req.auth!;
    const deleted = await withTenant(tenantId, async (tx) => {
      const receipt = await tx.receipt.findFirst({ where: { id: idParam(req), deletedAt: null } });
      if (!receipt) return false;
      await tx.receipt.update({ where: { id: receipt.id }, data: { deletedAt: new Date() } });
      await audit(tx, req, { tenantId, actorId: userId, action: "receipt.deleted", entityType: "receipt", entityId: receipt.id, beforeData: { number: receipt.number, amount: receipt.amount.toString() } });
      return true;
    });
    if (!deleted) return res.status(404).json({ error: "Receipt not found." });
    res.status(204).end();
  } catch (error) { next(error); }
});
