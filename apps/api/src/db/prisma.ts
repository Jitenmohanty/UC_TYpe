import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function assertRlsRuntimeSafety() {
  const roles = await prisma.$queryRaw<Array<{ rolsuper: boolean; rolbypassrls: boolean }>>`
    SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user
  `;
  if (roles.length !== 1 || roles[0].rolsuper || roles[0].rolbypassrls) {
    throw new Error("The API database role must not be a superuser or bypass row-level security.");
  }
  const privilegedMemberships = await prisma.$queryRaw<Array<{ roleName: string }>>`
    SELECT rolname AS "roleName" FROM pg_roles
    WHERE rolname <> current_user AND (rolsuper OR rolbypassrls)
      AND pg_has_role(current_user, oid, 'MEMBER')
  `;
  if (privilegedMemberships.length) {
    throw new Error("The API database role must not be a member of a superuser or RLS-bypass role.");
  }

  const missingPolicies = await prisma.$queryRaw<Array<{ tableName: string }>>`
    SELECT expected.table_name AS "tableName"
    FROM (VALUES
      ('users'), ('roles'), ('role_permissions'), ('tenant_modules'), ('otp_codes'),
      ('refresh_tokens'), ('audit_logs'), ('customers'), ('reference_persons'),
      ('bookings'), ('vehicles'), ('drivers'), ('booking_assignments'), ('vendors'),
      ('payments'), ('expenses'), ('commissions'), ('invoices'), ('receipts'),
      ('custom_field_defs'), ('tenant_counters')
    ) AS expected(table_name)
    LEFT JOIN pg_namespace n ON n.nspname = 'public'
    LEFT JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = expected.table_name
    LEFT JOIN pg_policies p ON p.schemaname = 'public'
      AND p.tablename = expected.table_name AND p.policyname = 'tenant_isolation'
    WHERE n.oid IS NULL OR c.oid IS NULL OR c.relrowsecurity IS NOT TRUE OR c.relforcerowsecurity IS NOT TRUE
      OR p.policyname IS NULL OR p.qual NOT LIKE '%app.tenant_id%'
      OR p.with_check NOT LIKE '%app.tenant_id%'
  `;
  if (missingPolicies.length) {
    throw new Error("Tenant row-level security is missing or not forced for required tables.");
  }
}

const globalModels = new Set(["Tenant", "Module", "Permission"]);

function scopeArgs(model: string, operation: string, input: Record<string, any>, tenantId: string) {
  const args = { ...input };
  if (globalModels.has(model)) return args;
  if (["findMany", "findFirst", "findFirstOrThrow", "findUnique", "findUniqueOrThrow", "count", "aggregate", "groupBy", "update", "updateMany", "delete", "deleteMany", "upsert"].includes(operation)) {
    args.where = { ...(args.where ?? {}), tenantId };
  }
  if (["create", "upsert"].includes(operation)) {
    args.data = { ...(args.data ?? {}), tenantId };
  }
  if (operation === "createMany") {
    const rows = Array.isArray(args.data) ? args.data : [args.data ?? {}];
    args.data = rows.map((row) => ({ ...row, tenantId }));
  }
  return args;
}

export function tenantClient(tenantId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          return query(scopeArgs(model, operation, args as Record<string, any>, tenantId));
        }
      }
    }
  });
}

// The tenant comes from the verified JWT. SET LOCAL is transaction-scoped, so pooled
// connections cannot retain one request's tenant context for the next request.
export async function withTenant<T>(tenantId: string, work: (tx: Prisma.TransactionClient) => Promise<T>) {
  const scoped = tenantClient(tenantId);
  return scoped.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    // Query extensions wrap the transaction client at runtime. The callback surface stays
    // on Prisma's transaction type so domain services can use normal Prisma model types.
    return work(tx as unknown as Prisma.TransactionClient);
  });
}
