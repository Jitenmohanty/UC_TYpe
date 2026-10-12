import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { withTenant } from "../../db/prisma.js";
import { requireAuth, requireModule, requirePermission, requireTenantUser } from "../../http/auth.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth, requireTenantUser, requirePermission("dashboard.view"), requireModule("bookings"));

const rangeSchema = z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() });
const decimalSum = (values: Prisma.Decimal[]) => values.reduce((sum, value) => sum.plus(value), new Prisma.Decimal(0));

dashboardRouter.get("/", async (req, res, next) => {
  try {
    const range = rangeSchema.parse(req.query);
    const now = new Date();
    const from = range.from ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const to = range.to ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    if (to <= from) return res.status(400).json({ error: "The end date must be after the start date." });
    const upcomingEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const tenantId = req.auth!.tenantId;
    const canViewFinance = req.auth!.role === "TENANT_ADMIN" || req.auth!.permissions.includes("payment.view");
    const data = await withTenant(tenantId, async (tx) => {
      const period = { gte: from, lt: to };
      const [bookings, totalBookings, expenses, payments, commissions, upcomingTrips] = await Promise.all([
        tx.booking.findMany({ where: { deletedAt: null, startDate: period, status: { not: "CANCELLED" } }, select: { id: true, serialNo: true, customerName: true, destination: true, startDate: true, totalAmount: true, status: true, payments: { where: { deletedAt: null }, select: { amount: true, direction: true } }, assignments: { where: { deletedAt: null }, include: { vehicle: true, driver: true }, take: 1 } } }),
        tx.booking.count({ where: { deletedAt: null, status: { not: "CANCELLED" } } }),
        tx.expense.findMany({ where: { deletedAt: null, incurredAt: period }, select: { amount: true, incurredAt: true } }),
        tx.payment.findMany({ where: { deletedAt: null, paidAt: period }, select: { amount: true, direction: true, paidAt: true } }),
        tx.commission.aggregate({ where: { deletedAt: null, createdAt: period }, _sum: { amount: true } }),
        tx.booking.findMany({ where: { deletedAt: null, status: { in: ["CONFIRMED", "ONGOING"] }, startDate: { gte: now, lt: upcomingEnd } }, orderBy: { startDate: "asc" }, take: 8, select: { id: true, serialNo: true, customerName: true, destination: true, startDate: true, totalAmount: true, advanceAmount: true, status: true, assignments: { where: { deletedAt: null }, include: { vehicle: true, driver: true }, take: 1 } } })
      ]);
      const revenue = decimalSum(bookings.map((booking) => booking.totalAmount));
      const pending = decimalSum(bookings.map((booking) => {
        const collected = decimalSum(booking.payments.filter((payment) => payment.direction === "INBOUND").map((payment) => payment.amount));
        const balance = booking.totalAmount.minus(collected);
        return balance.isNegative() ? new Prisma.Decimal(0) : balance;
      }));
      const vendorPayments = decimalSum(payments.filter((payment) => payment.direction === "OUTBOUND").map((payment) => payment.amount));
      const collected = decimalSum(payments.filter((payment) => payment.direction === "INBOUND").map((payment) => payment.amount));
      const expenseTotal = decimalSum(expenses.map((expense) => expense.amount));
      const commissionTotal = commissions._sum.amount ?? new Prisma.Decimal(0);
      const profit = revenue.minus(vendorPayments).minus(expenseTotal).minus(commissionTotal);
      const fleetCount = await tx.vehicle.count({ where: { deletedAt: null } });
      const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)));
      const bucketCount = Math.min(7, days);
      const trend = Array.from({ length: bucketCount }, (_, index) => {
        const bucketFrom = new Date(from.getTime() + Math.floor(index * days / bucketCount) * 24 * 60 * 60 * 1000);
        const bucketTo = new Date(from.getTime() + Math.floor((index + 1) * days / bucketCount) * 24 * 60 * 60 * 1000);
        const collectedInBucket = decimalSum(payments.filter((payment) => payment.direction === "INBOUND" && payment.paidAt >= bucketFrom && payment.paidAt < bucketTo).map((payment) => payment.amount));
        const expensesInBucket = decimalSum(expenses.filter((expense) => expense.incurredAt >= bucketFrom && expense.incurredAt < bucketTo).map((expense) => expense.amount));
        return { day: new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(bucketFrom), revenue: collectedInBucket.toFixed(2), expenses: expensesInBucket.toFixed(2) };
      });
      return {
        range: { from: from.toISOString(), to: to.toISOString() },
        metrics: {
          totalBookings,
          ...(canViewFinance ? {
            revenue: revenue.toFixed(2),
            collected: collected.toFixed(2),
            pendingPayments: pending.toFixed(2),
            expenses: expenseTotal.toFixed(2),
            vendorPayments: vendorPayments.toFixed(2),
            commissions: commissionTotal.toFixed(2),
            profit: profit.toFixed(2)
          } : {}),
          upcomingTrips: upcomingTrips.length,
          vehicles: fleetCount
        },
        trend: canViewFinance ? trend : [],
        upcoming: upcomingTrips.filter((trip) => trip.startDate <= upcomingEnd).map((trip) => {
          if (canViewFinance) return trip;
          const { totalAmount: _totalAmount, advanceAmount: _advanceAmount, ...safeTrip } = trip;
          return safeTrip;
        }),
        recentBookings: bookings.sort((a, b) => b.startDate.getTime() - a.startDate.getTime()).slice(0, 8).map((booking) => {
          const receivedAmount = decimalSum(booking.payments.filter((payment) => payment.direction === "INBOUND").map((payment) => payment.amount));
          const { payments: _payments, ...fields } = booking;
          if (canViewFinance) return { ...fields, receivedAmount: receivedAmount.toFixed(2) };
          const { totalAmount: _totalAmount, ...safeFields } = fields;
          return safeFields;
        })
      };
    });
    res.json(data);
  } catch (error) { next(error); }
});
