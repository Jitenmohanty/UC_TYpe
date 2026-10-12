import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { withTenant } from "../../db/prisma.js";
import { requireAuth, requireModule, requirePermission, requireTenantUser } from "../../http/auth.js";
import { listQuerySchema, pageInfo } from "../common.js";

export const reportsRouter = Router();
reportsRouter.use(requireAuth, requireTenantUser, requirePermission("report.view"), requireModule("reports"));

const reportFilters = listQuerySchema.extend({
  from: z.coerce.date().optional(), to: z.coerce.date().optional(),
  status: z.enum(["ENQUIRY", "CONFIRMED", "ONGOING", "COMPLETED", "CANCELLED"]).optional()
});
const sum = (items: Prisma.Decimal[]) => items.reduce((total, item) => total.plus(item), new Prisma.Decimal(0));
const rangeWhere = (from?: Date, to?: Date) => from || to ? { gte: from, ...(to ? { lte: to } : {}) } : undefined;

reportsRouter.get("/bookings", async (req, res, next) => {
  try {
    const query = reportFilters.parse(req.query);
    const where: Prisma.BookingWhereInput = {
      deletedAt: null, ...(query.status ? { status: query.status } : {}),
      ...(rangeWhere(query.from, query.to) ? { startDate: rangeWhere(query.from, query.to) } : {}),
      ...(query.search ? { OR: [{ serialNo: { contains: query.search, mode: "insensitive" } }, { customerName: { contains: query.search, mode: "insensitive" } }, { destination: { contains: query.search, mode: "insensitive" } }] } : {})
    };
    const result = await withTenant(req.auth!.tenantId, async (tx) => {
      const [items, total, aggregate] = await Promise.all([
        tx.booking.findMany({ where, include: { referencePerson: { select: { name: true } }, assignments: { where: { deletedAt: null }, include: { vehicle: { select: { registrationNo: true } }, driver: { select: { name: true } } } } }, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: { startDate: "desc" } }),
        tx.booking.count({ where }), tx.booking.aggregate({ where, _sum: { totalAmount: true } })
      ]);
      return { items, total, totalValue: (aggregate._sum.totalAmount ?? new Prisma.Decimal(0)).toFixed(2) };
    });
    res.json({ ...result, ...pageInfo(query.page, query.pageSize, result.total) });
  } catch (error) { next(error); }
});

reportsRouter.get("/payments", async (req, res, next) => {
  try {
    const query = reportFilters.parse(req.query);
    const where: Prisma.PaymentWhereInput = {
      deletedAt: null,
      ...(rangeWhere(query.from, query.to) ? { paidAt: rangeWhere(query.from, query.to) } : {}),
      ...(query.search ? { OR: [{ reference: { contains: query.search, mode: "insensitive" } }, { booking: { serialNo: { contains: query.search, mode: "insensitive" } } }, { vendor: { name: { contains: query.search, mode: "insensitive" } } }] } : {})
    };
    const result = await withTenant(req.auth!.tenantId, async (tx) => {
      const [items, total, inbound, outbound] = await Promise.all([
        tx.payment.findMany({ where, include: { booking: { select: { serialNo: true, customerName: true } }, vendor: { select: { name: true } } }, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: { paidAt: "desc" } }),
        tx.payment.count({ where }),
        tx.payment.aggregate({ where: { ...where, direction: "INBOUND" }, _sum: { amount: true } }),
        tx.payment.aggregate({ where: { ...where, direction: "OUTBOUND" }, _sum: { amount: true } })
      ]);
      return { items, total, totals: { received: (inbound._sum.amount ?? new Prisma.Decimal(0)).toFixed(2), paid: (outbound._sum.amount ?? new Prisma.Decimal(0)).toFixed(2) } };
    });
    res.json({ ...result, ...pageInfo(query.page, query.pageSize, result.total) });
  } catch (error) { next(error); }
});

reportsRouter.get("/outstanding", async (req, res, next) => {
  try {
    const query = reportFilters.parse(req.query);
    const where: Prisma.BookingWhereInput = { deletedAt: null, status: { not: "CANCELLED" }, ...(rangeWhere(query.from, query.to) ? { startDate: rangeWhere(query.from, query.to) } : {}), ...(query.search ? { OR: [{ serialNo: { contains: query.search, mode: "insensitive" } }, { customerName: { contains: query.search, mode: "insensitive" } }] } : {}) };
    const result = await withTenant(req.auth!.tenantId, async (tx) => {
      const bookings = await tx.booking.findMany({ where, include: { payments: { where: { direction: "INBOUND", deletedAt: null }, select: { amount: true } } }, orderBy: { startDate: "asc" } });
      const items = bookings.map((booking) => {
        const received = sum(booking.payments.map((payment) => payment.amount));
        const balance = booking.totalAmount.minus(received).isNegative() ? new Prisma.Decimal(0) : booking.totalAmount.minus(received);
        return { id: booking.id, serialNo: booking.serialNo, customerName: booking.customerName, destination: booking.destination, startDate: booking.startDate, totalAmount: booking.totalAmount.toFixed(2), received: received.toFixed(2), balance: balance.toFixed(2), status: booking.status };
      }).filter((booking) => new Prisma.Decimal(booking.balance).greaterThan(0));
      const offset = (query.page - 1) * query.pageSize;
      return { items: items.slice(offset, offset + query.pageSize), total: items.length, outstandingTotal: sum(items.map((item) => new Prisma.Decimal(item.balance))).toFixed(2) };
    });
    res.json({ ...result, ...pageInfo(query.page, query.pageSize, result.total) });
  } catch (error) { next(error); }
});

reportsRouter.get("/vendor-dues", async (req, res, next) => {
  try {
    const query = listQuerySchema.extend({ from: z.coerce.date().optional(), to: z.coerce.date().optional() }).parse(req.query);
    const dateFilter = rangeWhere(query.from, query.to);
    const vendors = await withTenant(req.auth!.tenantId, (tx) => tx.vendor.findMany({
      where: { deletedAt: null, ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}) }, orderBy: { name: "asc" },
      include: { expenses: { where: { deletedAt: null, ...(dateFilter ? { incurredAt: dateFilter } : {}) }, select: { amount: true } }, payments: { where: { deletedAt: null, direction: "OUTBOUND", ...(dateFilter ? { paidAt: dateFilter } : {}) }, select: { amount: true } } }
    }));
    const rows = vendors.map((vendor) => {
      const billed = sum(vendor.expenses.map((expense) => expense.amount));
      const paid = sum(vendor.payments.map((payment) => payment.amount));
      const due = billed.minus(paid);
      return { id: vendor.id, name: vendor.name, billed: billed.toFixed(2), paid: paid.toFixed(2), due: (due.isNegative() ? new Prisma.Decimal(0) : due).toFixed(2) };
    }).filter((row) => new Prisma.Decimal(row.due).greaterThan(0));
    const offset = (query.page - 1) * query.pageSize;
    res.json({ items: rows.slice(offset, offset + query.pageSize), totalDue: sum(rows.map((row) => new Prisma.Decimal(row.due))).toFixed(2), ...pageInfo(query.page, query.pageSize, rows.length) });
  } catch (error) { next(error); }
});

reportsRouter.get("/net-revenue", async (req, res, next) => {
  try {
    const query = z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() }).parse(req.query);
    const dateFilter = rangeWhere(query.from, query.to);
    const totals = await withTenant(req.auth!.tenantId, async (tx) => {
      const [bookings, payments, expenses, commissions] = await Promise.all([
        tx.booking.aggregate({ where: { deletedAt: null, status: { not: "CANCELLED" }, ...(dateFilter ? { startDate: dateFilter } : {}) }, _sum: { totalAmount: true } }),
        tx.payment.groupBy({ by: ["direction"], where: { deletedAt: null, ...(dateFilter ? { paidAt: dateFilter } : {}) }, _sum: { amount: true } }),
        tx.expense.aggregate({ where: { deletedAt: null, ...(dateFilter ? { incurredAt: dateFilter } : {}) }, _sum: { amount: true } }),
        tx.commission.aggregate({ where: { deletedAt: null, ...(dateFilter ? { createdAt: dateFilter } : {}) }, _sum: { amount: true } })
      ]);
      const revenue = bookings._sum.totalAmount ?? new Prisma.Decimal(0);
      const vendorPayments = payments.find((item) => item.direction === "OUTBOUND")?._sum.amount ?? new Prisma.Decimal(0);
      const collected = payments.find((item) => item.direction === "INBOUND")?._sum.amount ?? new Prisma.Decimal(0);
      const expenseTotal = expenses._sum.amount ?? new Prisma.Decimal(0);
      const commissionTotal = commissions._sum.amount ?? new Prisma.Decimal(0);
      return {
        revenue: revenue.toFixed(2), collected: collected.toFixed(2), vendorPayments: vendorPayments.toFixed(2), expenses: expenseTotal.toFixed(2), commissions: commissionTotal.toFixed(2),
        netRevenue: revenue.minus(vendorPayments).minus(expenseTotal).minus(commissionTotal).toFixed(2)
      };
    });
    res.json({ range: { from: query.from?.toISOString() ?? null, to: query.to?.toISOString() ?? null }, ...totals });
  } catch (error) { next(error); }
});
