import "../src/config/env.js";
import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";
import { permissionKeys } from "@routewise/shared";

const url = process.env.MIGRATION_DATABASE_URL;
if (!url) throw new Error("MIGRATION_DATABASE_URL is required for seeding.");
if (process.env.ALLOW_DEMO_SEED !== "true") {
  throw new Error("Demo seeding is disabled. Set ALLOW_DEMO_SEED=true only for an isolated test environment.");
}
const demoPassword = process.env.DEMO_SEED_PASSWORD ?? "";
if (demoPassword.length < 20) {
  throw new Error("DEMO_SEED_PASSWORD must be set to a unique password with at least 20 characters.");
}
const seedUrl = new URL(url);
seedUrl.searchParams.set("connection_limit", "4");
const prisma = new PrismaClient({ datasources: { db: { url: seedUrl.toString() } } });

const permissionSeeds = permissionKeys.map((key) => [key, key.replaceAll(".", " ").replaceAll("-", " ")] as const);

const moduleSeeds = [
  ["bookings", "Bookings"], ["fleet", "Fleet"], ["accounts", "Accounts"],
  ["customers", "Customers"], ["reports", "Reports"]
] as const;

const tenantSeeds = [
  { name: "Western Trails Travel", slug: "western-trails", admin: "Mira Patel", email: "admin@westerntrails.demo", phone: "+91 98200 10001" },
  { name: "Blue Coast Journeys", slug: "blue-coast", admin: "Aarav Shah", email: "admin@bluecoast.demo", phone: "+91 98200 10002" },
  { name: "Highland Route Co.", slug: "highland-route", admin: "Kavya Rao", email: "admin@highlandroute.demo", phone: "+91 98200 10003" }
];

async function main() {
  const demoPasswordHash = await argon2.hash(demoPassword, { type: argon2.argon2id });
  const superEmail = "platform.admin@routewise.demo";
  const superAdmin = await prisma.user.findFirst({ where: { email: superEmail, roleKey: "SUPER_ADMIN" } });
  if (superAdmin) {
    await prisma.user.update({ where: { id: superAdmin.id }, data: { name: "Routewise Platform Admin", passwordHash: demoPasswordHash } });
  } else {
    await prisma.user.create({ data: { email: superEmail, name: "Routewise Platform Admin", passwordHash: demoPasswordHash, roleKey: "SUPER_ADMIN" } });
  }

  const permissions = await Promise.all(permissionSeeds.map(([key, description]) => prisma.permission.upsert({
    where: { key }, create: { key, description }, update: { description }
  })));
  const modules = await Promise.all(moduleSeeds.map(([key, name]) => prisma.module.upsert({
    where: { key }, create: { key, name }, update: { name }
  })));

  for (const seed of tenantSeeds) {
    const tenant = await prisma.tenant.upsert({
      where: { slug: seed.slug },
      create: { name: seed.name, slug: seed.slug, currency: "INR", settings: { invoicePrefix: seed.slug.slice(0, 2).toUpperCase() } },
      update: { name: seed.name }
    });
    const adminRole = await prisma.role.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: "TENANT_ADMIN" } },
      create: { tenantId: tenant.id, key: "TENANT_ADMIN", name: "Workspace admin" }, update: { name: "Workspace admin" }
    });
    const employeeRole = await prisma.role.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: "DISPATCHER" } },
      create: { tenantId: tenant.id, key: "DISPATCHER", name: "Dispatcher" }, update: { name: "Dispatcher" }
    });
    for (const role of [adminRole, employeeRole]) {
      const rolePermissions = role.id === adminRole.id
        ? permissions
        : permissions.filter(({ key }) => [
          "dashboard.view", "booking.view", "booking.create", "booking.update",
          "customer.view", "customer.create", "customer.update", "vehicle.view", "driver.view"
        ].includes(key));
      await prisma.rolePermission.createMany({
        data: rolePermissions.map((permission) => ({ tenantId: tenant.id, roleId: role.id, permissionId: permission.id })),
        skipDuplicates: true
      });
    }
    await prisma.tenantModule.createMany({
      data: modules.map((module) => ({ tenantId: tenant.id, moduleId: module.id, enabled: true })),
      skipDuplicates: true
    });

    const admin = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: seed.email } },
      create: { tenantId: tenant.id, roleId: adminRole.id, email: seed.email, name: seed.admin, passwordHash: demoPasswordHash, roleKey: "TENANT_ADMIN", emailVerifiedAt: new Date() },
      update: { roleId: adminRole.id, name: seed.admin, passwordHash: demoPasswordHash, roleKey: "TENANT_ADMIN" }
    });
    const employeeEmail = `employee@${seed.slug}.demo`;
    await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: employeeEmail } },
      create: { tenantId: tenant.id, roleId: employeeRole.id, email: employeeEmail, name: "Dispatch Coordinator", passwordHash: demoPasswordHash, roleKey: "EMPLOYEE", emailVerifiedAt: new Date() },
      update: { roleId: employeeRole.id, name: "Dispatch Coordinator", passwordHash: demoPasswordHash, roleKey: "EMPLOYEE" }
    });

    const customerEmail = `guest@${seed.slug}.demo`;
    const customer = await prisma.customer.findFirst({ where: { tenantId: tenant.id, email: customerEmail } }) ?? await prisma.customer.create({
      data: { tenantId: tenant.id, name: "Aarav Mehta", email: customerEmail, phone: seed.phone, company: "Mehta Family Travel" }
    });
    const vehicle = await prisma.vehicle.upsert({
      where: { tenantId_registrationNo: { tenantId: tenant.id, registrationNo: `${seed.slug.slice(0, 2).toUpperCase()} 02 AB 4832` } },
      create: { tenantId: tenant.id, registrationNo: `${seed.slug.slice(0, 2).toUpperCase()} 02 AB 4832`, type: "Premium SUV", capacity: 6, insuranceExpires: new Date("2026-11-04") },
      update: { type: "Premium SUV", capacity: 6 }
    });
    const driver = await prisma.driver.upsert({
      where: { tenantId_licenseNo: { tenantId: tenant.id, licenseNo: `${seed.slug.slice(0, 3).toUpperCase()}-DL-0921` } },
      create: { tenantId: tenant.id, name: "Devendra Patil", phone: seed.phone, licenseNo: `${seed.slug.slice(0, 3).toUpperCase()}-DL-0921`, licenseExpires: new Date("2027-02-28") },
      update: { name: "Devendra Patil", phone: seed.phone }
    });
    const bookingExists = await prisma.booking.findFirst({ where: { tenantId: tenant.id, serialNo: "BK-2026-0001" } });
    if (!bookingExists) {
      const booking = await prisma.booking.create({ data: {
        tenantId: tenant.id, serialNo: "BK-2026-0001", customerId: customer.id,
        createdById: admin.id, customerName: customer.name, customerEmail: customer.email,
        customerPhone: customer.phone, destination: "Mumbai to Nashik", startDate: new Date("2026-10-12T01:00:00Z"),
        totalAmount: "18400.00", advanceAmount: "8000.00", status: "CONFIRMED"
      } });
      const endAt = new Date(booking.startDate.getTime() + 8 * 60 * 60 * 1000);
      await prisma.bookingAssignment.create({ data: { tenantId: tenant.id, bookingId: booking.id, vehicleId: vehicle.id, driverId: driver.id, startAt: booking.startDate, endAt } });
      await prisma.payment.create({ data: { tenantId: tenant.id, bookingId: booking.id, amount: "8000.00", direction: "INBOUND", method: "UPI", paidAt: new Date() } });
    }
  }
  console.log(`Seeded ${tenantSeeds.length} demo tenants and their platform admin, tenant admins, employees, roles, and sample travel data.`);
  console.log("All demo accounts use the password supplied through DEMO_SEED_PASSWORD; the password is never logged.");
}

main().catch((error: unknown) => {
  console.error("Seed failed", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
