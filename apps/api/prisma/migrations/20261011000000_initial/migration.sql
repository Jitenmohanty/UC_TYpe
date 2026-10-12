CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'TENANT_ADMIN', 'EMPLOYEE');
CREATE TYPE "TripStatus" AS ENUM ('ENQUIRY', 'CONFIRMED', 'ONGOING', 'COMPLETED', 'CANCELLED');
CREATE TYPE "OtpPurpose" AS ENUM ('LOGIN_2FA', 'VERIFY_EMAIL', 'RESET_PASSWORD');

CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(160) NOT NULL,
  slug varchar(80) NOT NULL UNIQUE, plan_key varchar(40) NOT NULL DEFAULT 'starter',
  currency char(3) NOT NULL DEFAULT 'INR', settings jsonb NOT NULL DEFAULT '{}',
  suspended_at timestamptz, deleted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  role_id uuid, email varchar(254) NOT NULL, password_hash varchar(255) NOT NULL,
  name varchar(160) NOT NULL, role_key "UserRole" NOT NULL DEFAULT 'EMPLOYEE',
  email_verified_at timestamptz, failed_login_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz, deleted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_tenant_id_email_key ON users(tenant_id, email);
CREATE INDEX users_tenant_id_created_at_idx ON users(tenant_id, created_at);
CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key varchar(60) NOT NULL, name varchar(100) NOT NULL, deleted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key)
);
ALTER TABLE users ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL;
CREATE TABLE permissions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), key varchar(80) NOT NULL UNIQUE, description varchar(200) NOT NULL);
CREATE TABLE role_permissions (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (tenant_id, role_id, permission_id)
);
CREATE TABLE modules (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), key varchar(60) NOT NULL UNIQUE, name varchar(100) NOT NULL);
CREATE TABLE tenant_modules (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true, PRIMARY KEY (tenant_id, module_id)
);
CREATE TABLE otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE, user_id uuid NOT NULL, email varchar(254) NOT NULL,
  purpose "OtpPurpose" NOT NULL, code_hash varchar(128) NOT NULL, attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL, consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX otp_codes_lookup_idx ON otp_codes(tenant_id, email, purpose, created_at);
CREATE TABLE refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE, user_id uuid NOT NULL,
  token_hash varchar(128) NOT NULL UNIQUE, family_id uuid NOT NULL, expires_at timestamptz NOT NULL,
  revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_lookup_idx ON refresh_tokens(tenant_id, user_id, expires_at);
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, actor_id uuid,
  action varchar(120) NOT NULL, entity_type varchar(80) NOT NULL, entity_id uuid,
  before_data jsonb, after_data jsonb, ip_address varchar(64), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_tenant_id_created_at_idx ON audit_logs(tenant_id, created_at);
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL, email varchar(254), phone varchar(30) NOT NULL, company varchar(160), notes text,
  custom_fields jsonb NOT NULL DEFAULT '{}', deleted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customers_tenant_id_created_at_idx ON customers(tenant_id, created_at);
CREATE INDEX customers_tenant_id_name_idx ON customers(tenant_id, name);
CREATE TABLE reference_persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, name varchar(160) NOT NULL,
  phone varchar(30), email varchar(254), deleted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reference_persons_tenant_id_name_idx ON reference_persons(tenant_id, name);
CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, serial_no varchar(32) NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL, reference_person_id uuid REFERENCES reference_persons(id) ON DELETE SET NULL,
  created_by_id uuid REFERENCES users(id) ON DELETE SET NULL, customer_name varchar(160) NOT NULL,
  customer_email varchar(254), customer_phone varchar(30) NOT NULL, destination varchar(180) NOT NULL,
  start_date timestamptz NOT NULL, total_amount numeric(14,2) NOT NULL, advance_amount numeric(14,2) NOT NULL DEFAULT 0,
  status "TripStatus" NOT NULL DEFAULT 'ENQUIRY', notes text, custom_fields jsonb NOT NULL DEFAULT '{}',
  deleted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, serial_no), CHECK (total_amount >= 0 AND advance_amount >= 0 AND advance_amount <= total_amount)
);
CREATE INDEX bookings_tenant_id_start_date_idx ON bookings(tenant_id, start_date);
CREATE INDEX bookings_tenant_id_status_start_date_idx ON bookings(tenant_id, status, start_date);
CREATE INDEX bookings_tenant_id_customer_name_idx ON bookings(tenant_id, customer_name);
CREATE TABLE vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  registration_no varchar(24) NOT NULL, type varchar(60) NOT NULL, capacity integer NOT NULL,
  insurance_expires date, permit_expires date, notes text, deleted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, registration_no), CHECK (capacity > 0)
);
CREATE INDEX vehicles_tenant_id_created_at_idx ON vehicles(tenant_id, created_at);
CREATE TABLE drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL, phone varchar(30) NOT NULL, license_no varchar(40) NOT NULL,
  license_expires date, deleted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, license_no)
);
CREATE INDEX drivers_tenant_id_name_idx ON drivers(tenant_id, name);
CREATE TABLE booking_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL, driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  start_at timestamptz NOT NULL, end_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), CHECK (end_at > start_at)
);
CREATE INDEX assignments_tenant_time_idx ON booking_assignments(tenant_id, start_at, end_at);
CREATE INDEX assignments_tenant_vehicle_time_idx ON booking_assignments(tenant_id, vehicle_id, start_at, end_at);
CREATE INDEX assignments_tenant_driver_time_idx ON booking_assignments(tenant_id, driver_id, start_at, end_at);
CREATE TABLE vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL, phone varchar(30), email varchar(254), service_type varchar(80),
  deleted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vendors_tenant_id_name_idx ON vendors(tenant_id, name);
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL, amount numeric(14,2) NOT NULL, direction varchar(16) NOT NULL,
  method varchar(40), reference varchar(100), paid_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), CHECK (amount >= 0)
);
CREATE INDEX payments_tenant_id_paid_at_idx ON payments(tenant_id, paid_at);
CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL,
  category varchar(80) NOT NULL, description varchar(240), amount numeric(14,2) NOT NULL,
  incurred_at timestamptz NOT NULL, deleted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), CHECK (amount >= 0)
);
CREATE INDEX expenses_tenant_id_incurred_at_idx ON expenses(tenant_id, incurred_at);
CREATE TABLE commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, booking_id uuid NOT NULL,
  amount numeric(14,2) NOT NULL, payee_name varchar(160), created_at timestamptz NOT NULL DEFAULT now(), CHECK (amount >= 0)
);
CREATE INDEX commissions_tenant_booking_idx ON commissions(tenant_id, booking_id);
CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  number varchar(40) NOT NULL, total numeric(14,2) NOT NULL, issued_at timestamptz NOT NULL, due_at timestamptz,
  deleted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, number), CHECK (total >= 0)
);
CREATE TABLE receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  payment_id uuid, number varchar(40) NOT NULL, amount numeric(14,2) NOT NULL, issued_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, number), CHECK (amount >= 0)
);
CREATE TABLE custom_field_defs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, entity_type varchar(60) NOT NULL,
  key varchar(80) NOT NULL, label varchar(120) NOT NULL, field_type varchar(24) NOT NULL,
  options jsonb NOT NULL DEFAULT '[]', required boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, entity_type, key)
);
CREATE TABLE tenant_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, year integer NOT NULL,
  resource varchar(40) NOT NULL, value integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, year, resource)
);

-- All tenant tables fail closed when a request has no verified tenant context.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'users', 'roles', 'role_permissions', 'tenant_modules', 'otp_codes', 'refresh_tokens',
    'audit_logs', 'customers', 'reference_persons', 'bookings', 'vehicles', 'drivers',
    'booking_assignments', 'vendors', 'payments', 'expenses', 'commissions', 'invoices',
    'receipts', 'custom_field_defs', 'tenant_counters'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid)',
      table_name
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO routewise_app', table_name);
  END LOOP;
END
$$;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenants, modules, permissions TO routewise_app;
