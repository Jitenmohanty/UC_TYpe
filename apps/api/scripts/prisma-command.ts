import "../src/config/env.js";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const migrationUrl = process.env.MIGRATION_DATABASE_URL;
if (!migrationUrl) {
  throw new Error("MIGRATION_DATABASE_URL is required for schema changes.");
}
const configuredMigrationUrl = migrationUrl;

async function main() {
  const runtimeUrl = process.env.DATABASE_URL;
  if (!runtimeUrl) throw new Error("DATABASE_URL is required to provision the restricted API role.");

  const runtimeConnection = new URL(runtimeUrl);
  const runtimeRole = decodeURIComponent(runtimeConnection.username);
  const runtimePassword = decodeURIComponent(runtimeConnection.password);
  const poolerProjectRef = runtimeRole.startsWith("routewise_app.") ? runtimeRole.slice("routewise_app.".length) : null;
  const migrationRole = decodeURIComponent(new URL(configuredMigrationUrl).username);
  if (
    (runtimeRole !== "routewise_app" && !poolerProjectRef) ||
    (poolerProjectRef && migrationRole !== `postgres.${poolerProjectRef}`) ||
    !runtimePassword
  ) {
    throw new Error("DATABASE_URL must use routewise_app with a password; the API must not use the migration owner.");
  }

  const admin = new PrismaClient({ datasources: { db: { url: configuredMigrationUrl } } });
  try {
    const roleSql = await admin.$queryRaw<Array<{ sql: string }>>`
      SELECT format(
        CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'routewise_app')
          THEN 'ALTER ROLE %I WITH LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD %L'
          ELSE 'CREATE ROLE %I WITH LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD %L'
        END,
        'routewise_app', ${runtimePassword}
      ) AS sql
    `;
    await admin.$executeRawUnsafe(roleSql[0].sql);
    const grants = await admin.$queryRaw<Array<{ sql: string }>>`
      SELECT format('GRANT CONNECT ON DATABASE %I TO routewise_app', current_database()) AS sql
      UNION ALL SELECT 'GRANT USAGE ON SCHEMA public TO routewise_app'
      UNION ALL SELECT format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO routewise_app',
        current_user
      )
    `;
    for (const grant of grants) await admin.$executeRawUnsafe(grant.sql);

    const unsafeRole = await admin.$queryRaw<Array<{ unsafe: boolean }>>`
      SELECT r.rolsuper OR r.rolbypassrls OR EXISTS (
        SELECT 1 FROM pg_roles privileged
        WHERE (privileged.rolsuper OR privileged.rolbypassrls)
          AND privileged.rolname <> r.rolname
          AND pg_has_role(r.oid, privileged.oid, 'MEMBER')
      ) AS unsafe
      FROM pg_roles r WHERE r.rolname = 'routewise_app'
    `;
    if (unsafeRole.length !== 1 || unsafeRole[0].unsafe) {
      throw new Error("routewise_app must not be a superuser or inherit a role that bypasses row-level security.");
    }
  } finally {
    await admin.$disconnect();
  }

  const result = spawnSync("pnpm", ["exec", "prisma", ...process.argv.slice(2)], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: configuredMigrationUrl },
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Database role setup failed.");
  process.exitCode = 1;
});
