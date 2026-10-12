import "../src/config/env.js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { withTenant } from "../src/db/prisma.js";

const migrationUrl = process.env.MIGRATION_DATABASE_URL;
if (!migrationUrl) throw new Error("MIGRATION_DATABASE_URL is required for the tenant isolation check.");
const admin = new PrismaClient({ datasources: { db: { url: migrationUrl } } });
const suffix = randomUUID();
const blockedWriteSerial = `BK-2026-W-${suffix.slice(0, 4)}`;
let tenantA: { id: string } | undefined;
let tenantB: { id: string } | undefined;
let bookingB: { id: string } | undefined;

try {
  tenantA = await admin.tenant.create({ data: { name: `Isolation A ${suffix.slice(0, 8)}`, slug: `isolation-a-${suffix}` } });
  tenantB = await admin.tenant.create({ data: { name: `Isolation B ${suffix.slice(0, 8)}`, slug: `isolation-b-${suffix}` } });
  bookingB = await admin.booking.create({ data: {
    tenantId: tenantB.id, serialNo: `BK-2026-${suffix.slice(0, 4)}`,
    customerName: "Tenant B private record", customerPhone: "+919999000000",
    destination: "Private route", startDate: new Date("2026-12-01T08:00:00Z"),
    totalAmount: "1200.00", advanceAmount: "0.00"
  } });

  const crossTenantRead = await withTenant(tenantA.id, (tx) => tx.booking.findUnique({ where: { id: bookingB!.id } }));
  assert.equal(crossTenantRead, null, "Tenant A must not read Tenant B's booking.");

  const unscopedRead = await withTenant(tenantA.id, (tx) => tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM bookings WHERE id = ${bookingB!.id}::uuid
  `);
  assert.equal(unscopedRead.length, 0, "RLS must hide Tenant B's booking even when a query has no tenant filter.");

  let crossTenantWriteWasBlocked = false;
  try {
    await withTenant(tenantA.id, (tx) => tx.$executeRaw`
      INSERT INTO bookings (tenant_id, serial_no, customer_name, customer_phone, destination, start_date, total_amount, advance_amount)
      VALUES (${tenantB!.id}::uuid, ${blockedWriteSerial}, 'Cross-tenant write', '+919999000001', 'Must be rejected',
        ${new Date("2026-12-02T08:00:00Z")}, 100.00, 0.00)
    `);
  } catch {
    crossTenantWriteWasBlocked = true;
  }
  assert.equal(crossTenantWriteWasBlocked, true, "RLS must reject a write whose tenant_id differs from the verified context.");
  console.log("Tenant isolation passed: cross-tenant reads are hidden and writes are rejected.");
} finally {
  if (tenantB) await admin.booking.deleteMany({ where: { tenantId: tenantB.id, serialNo: blockedWriteSerial } });
  if (bookingB) await admin.booking.deleteMany({ where: { id: bookingB.id } });
  if (tenantA) await admin.tenant.delete({ where: { id: tenantA.id } });
  if (tenantB) await admin.tenant.delete({ where: { id: tenantB.id } });
  await admin.$disconnect();
}
