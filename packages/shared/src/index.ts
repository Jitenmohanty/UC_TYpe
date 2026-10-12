import { z } from "zod";

export const tripStatuses = ["ENQUIRY", "CONFIRMED", "ONGOING", "COMPLETED", "CANCELLED"] as const;
export type TripStatus = (typeof tripStatuses)[number];

// Amounts travel as decimal strings through JSON. This avoids binary float rounding.
const moneyString = z.string().regex(/^\d{1,12}(?:\.\d{1,2})?$/, "Enter an amount with up to two decimal places.");
const toMinorUnits = (amount: string) => {
  const [whole, fraction = ""] = amount.split(".");
  return BigInt(whole) * 100n + BigInt((fraction + "00").slice(0, 2));
};

const bookingFieldsSchema = z.object({
  customerName: z.string().trim().min(2).max(120),
  customerEmail: z.string().trim().email().max(254).optional().or(z.literal("")),
  customerPhone: z.string().trim().min(7).max(30),
  customerId: z.string().uuid().nullable().optional(),
  referencePersonId: z.string().uuid().nullable().optional(),
  referencePersonName: z.string().trim().min(2).max(160).optional().or(z.literal("")),
  destination: z.string().trim().min(2).max(180),
  startDate: z.coerce.date(),
  totalAmount: moneyString,
  advanceAmount: moneyString,
  status: z.enum(tripStatuses).default("ENQUIRY"),
  notes: z.string().trim().max(2000).optional()
});

export const createBookingSchema = bookingFieldsSchema.superRefine((booking, ctx) => {
  if (toMinorUnits(booking.advanceAmount) > toMinorUnits(booking.totalAmount)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["advanceAmount"], message: "Advance cannot exceed the booking total." });
  }
});

export const updateBookingSchema = bookingFieldsSchema.partial().superRefine((booking, ctx) => {
  if (booking.advanceAmount !== undefined && booking.totalAmount !== undefined && toMinorUnits(booking.advanceAmount) > toMinorUnits(booking.totalAmount)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["advanceAmount"], message: "Advance cannot exceed the booking total." });
  }
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const permissionKeys = [
  "booking.view", "booking.create", "booking.update", "booking.delete",
  "customer.view", "customer.create", "customer.update", "customer.delete",
  "vehicle.view", "vehicle.create", "vehicle.update", "vehicle.delete",
  "driver.view", "driver.create", "driver.update", "driver.delete",
  "vendor.view", "vendor.create", "vendor.update", "vendor.delete",
  "payment.view", "payment.create", "payment.update", "payment.delete",
  "expense.view", "expense.create", "expense.update", "expense.delete",
  "commission.view", "commission.create", "commission.update", "commission.delete",
  "invoice.view", "invoice.create", "invoice.update", "invoice.delete",
  "receipt.view", "receipt.create", "receipt.update", "receipt.delete",
  "report.view", "report.export", "dashboard.view",
  "employee.manage", "role.manage", "tenant.settings", "audit.view"
] as const;

export type PermissionKey = (typeof permissionKeys)[number];
export type TenantRole = "TENANT_ADMIN" | "EMPLOYEE";

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(200),
  tenantSlug: z.string().trim().min(2).max(80).optional()
});

export const tenantProvisionSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  planKey: z.string().trim().min(2).max(40).default("starter"),
  currency: z.string().trim().length(3).default("INR"),
  adminName: z.string().trim().min(2).max(160),
  adminEmail: z.string().trim().email().max(254),
  adminPassword: z.string().min(10).max(200).regex(/[a-z]/, "Use a lowercase letter.").regex(/[A-Z]/, "Use an uppercase letter.").regex(/[0-9]/, "Use a number.").regex(/[^A-Za-z0-9]/, "Use a symbol."),
  modules: z.array(z.string().trim().min(2).max(60)).max(30).optional()
});

export const roleInputSchema = z.object({
  key: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60),
  name: z.string().trim().min(2).max(100),
  permissions: z.array(z.enum(permissionKeys)).max(permissionKeys.length)
});

export const employeeInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(200).regex(/[a-z]/, "Use a lowercase letter.").regex(/[A-Z]/, "Use an uppercase letter.").regex(/[0-9]/, "Use a number.").regex(/[^A-Za-z0-9]/, "Use a symbol."),
  roleId: z.string().uuid()
});

export const vehicleInputSchema = z.object({
  registrationNo: z.string().trim().min(2).max(24),
  type: z.string().trim().min(2).max(60),
  capacity: z.coerce.number().int().min(1).max(100),
  insuranceExpires: z.coerce.date().optional(),
  permitExpires: z.coerce.date().optional(),
  notes: z.string().trim().max(2000).optional()
});

export const driverInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(7).max(30),
  licenseNo: z.string().trim().min(2).max(40),
  licenseExpires: z.coerce.date().optional()
});

export const vendorInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(7).max(30).optional(),
  email: z.string().trim().email().max(254).optional(),
  serviceType: z.string().trim().max(80).optional()
});

export const assignmentInputSchema = z.object({
  vehicleId: z.string().uuid().optional(),
  driverId: z.string().uuid().optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date()
}).refine((value) => Boolean(value.vehicleId || value.driverId), "Choose a vehicle or driver.")
  .refine((value) => value.endAt > value.startAt, "End time must be after start time.");

export const paymentInputSchema = z.object({
  bookingId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
  amount: moneyString,
  direction: z.enum(["INBOUND", "OUTBOUND"]),
  method: z.string().trim().max(40).optional(),
  reference: z.string().trim().max(100).optional(),
  paidAt: z.coerce.date()
});

export const expenseInputSchema = z.object({
  vendorId: z.string().uuid().optional(),
  category: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional(),
  amount: moneyString,
  incurredAt: z.coerce.date()
});

export const commissionInputSchema = z.object({
  bookingId: z.string().uuid(),
  amount: moneyString,
  payeeName: z.string().trim().max(160).optional()
});

export const invoiceInputSchema = z.object({
  bookingId: z.string().uuid(),
  total: moneyString,
  issuedAt: z.coerce.date(),
  dueAt: z.coerce.date().optional()
});

export const receiptInputSchema = z.object({
  invoiceId: z.string().uuid().optional(),
  paymentId: z.string().uuid().optional(),
  amount: moneyString,
  issuedAt: z.coerce.date()
});

export const bookingQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(120).optional(),
  status: z.enum(tripStatuses).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sort: z.enum(["startDate", "createdAt", "totalAmount"]).default("startDate"),
  direction: z.enum(["asc", "desc"]).default("asc")
});
