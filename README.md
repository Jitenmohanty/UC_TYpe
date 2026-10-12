# Routewise CRM

Multi-tenant operations CRM for travel and transport businesses. The workspace is a pnpm monorepo with a Next.js console, Express API, shared Zod contracts, and PostgreSQL/Prisma storage.

## Local setup

Requirements: Node.js 20.9 or newer, pnpm, and Docker Desktop.

```powershell
Copy-Item .env.example .env
docker compose up -d
pnpm install
pnpm db:generate
pnpm db:migrate
$env:ALLOW_DEMO_SEED = "true"
# Set a unique password of at least 20 characters in your local environment first.
pnpm db:seed
pnpm dev
```

The console runs at `http://localhost:3000`, API at `http://localhost:4000`, and MailHog at `http://localhost:8025`. Keep `DATABASE_URL` pointed at the restricted `routewise_app` role. Use `MIGRATION_DATABASE_URL` only for schema setup and seeding. Replace local secrets before deployment. Demo seeding refuses to run unless `ALLOW_DEMO_SEED=true` and `DEMO_SEED_PASSWORD` is set to a unique password of at least 20 characters. Never enable demo seeding in production; seed synthetic accounts only in an isolated test environment. The seed script does not print the password.

## Implemented workflows

- **Platform owner:** separate sign-in, onboard a business with its first tenant admin, enable modules, change plan keys, and suspend/reactivate workspaces.
- **Tenant team:** create and edit employee roles with individual view/create/update/delete permissions, add employees, change their role, and remove access. Employee sessions are revoked when their account is removed.
- **Dashboard:** tenant-scoped booking totals, upcoming trips, revenue, collections, outstanding balance, expenses, vendor payments, commissions, profit, and cash-flow trend. Payment figures are omitted from the dashboard API for employees without `payment.view`.
- **Bookings:** tenant/year booking serials, client name/email/phone, destination and date, reference person, trip status, optional advance payment, edit and soft-delete, and vehicle/driver assignment with overlap checks.
- **Fleet and customers:** create, view, update and soft-delete vehicles, drivers, customers and vendors, subject to each employee's assigned permissions.
- **Accounts:** payment ledger for customer advances/balances and vendor payouts, expenses, commissions, invoices and receipts. Financial amounts use decimal types and invoice/receipt balances are validated.
- **Reports:** booking history, payment totals, outstanding balances, vendor dues and net revenue, with tenant-filtered CSV download in the console.

## API surface

All routes below are prefixed with `/api`. Tenant routes require a current active tenant session, enabled module, and matching permission. API validation uses shared Zod schemas.

| Area | Routes |
|---|---|
| Health and authentication | `GET /health`; `/auth/login`, `/auth/platform-login`, `/auth/refresh`, `/auth/logout`, `/auth/logout-all`, `/auth/change-password`, `/auth/me` |
| Platform owner | `/platform/modules`, `/platform/tenants`, `/platform/tenants/:id`, `/platform/tenants/:id/modules/:key` |
| Dashboard and bookings | `/dashboard`; `/bookings` and `/bookings/:id` including `/assignment` |
| Fleet and customers | `/vehicles`, `/drivers`, `/customers` |
| Accounts | `/vendors`; `/accounts/payments`, `/expenses`, `/commissions`, `/invoices`, `/receipts` |
| Reports | `/reports/bookings`, `/payments`, `/outstanding`, `/vendor-dues`, `/net-revenue` |
| Team | `/team/permissions`, `/roles`, `/employees` |

## Tenant isolation and access control

Tenant identity comes only from the verified access token. The API reloads the user's current active status and role permissions for tenant requests, then scopes database work to that tenant inside a transaction that sets `app.tenant_id`. PostgreSQL row-level security is the final tenant data filter. At startup, the API checks that the database role cannot bypass RLS and that each tenant table has forced RLS with its tenant policy; it refuses to serve if either check fails. Platform routes require a separate `SUPER_ADMIN` role. Employee permissions are enforced by the API as well as hidden in the console; UI controls alone are not the security boundary.

Booking and invoice serial numbers are allocated with per-tenant counters. Business records use soft deletion. Database exclusion constraints prevent overlapping vehicle/driver assignments even when requests race.

## Verification and remaining work

The shared contracts check, API TypeScript build/lint, and web lint/production build are available through pnpm. The tenant-isolation integration script requires PostgreSQL. Live API and database behavior still needs verification in an environment where Docker/PostgreSQL is running.

The original broader product brief also calls for email verification, OTP-based login, password reset, XLSX/PDF exports, platform analytics and audited impersonation, utilization/performance reports, and custom-field settings. Those are not part of the implemented workflows above yet. The current console export is CSV.
