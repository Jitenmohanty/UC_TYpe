ALTER TABLE booking_assignments ADD COLUMN deleted_at timestamptz;
ALTER TABLE payments ADD COLUMN deleted_at timestamptz;
ALTER TABLE commissions ADD COLUMN deleted_at timestamptz;
ALTER TABLE receipts ADD COLUMN deleted_at timestamptz;
ALTER TABLE commissions
  ADD CONSTRAINT commissions_booking_id_fkey
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;

-- The application checks overlaps for a useful response; exclusion constraints
-- keep simultaneous requests from double-booking the same vehicle or driver.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE booking_assignments
  ADD CONSTRAINT booking_assignments_vehicle_no_overlap
  EXCLUDE USING gist (
    tenant_id WITH =,
    vehicle_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  ) WHERE (vehicle_id IS NOT NULL AND deleted_at IS NULL);
ALTER TABLE booking_assignments
  ADD CONSTRAINT booking_assignments_driver_no_overlap
  EXCLUDE USING gist (
    tenant_id WITH =,
    driver_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  ) WHERE (driver_id IS NOT NULL AND deleted_at IS NULL);

-- Platform sign-in may read only the tenantless super-admin identity and its
-- tenantless refresh session, and only when no tenant has been selected.
CREATE POLICY platform_super_admin_login ON users FOR SELECT
  USING (tenant_id IS NULL AND role_key = 'SUPER_ADMIN' AND nullif(current_setting('app.tenant_id', true), '') IS NULL);
CREATE POLICY platform_refresh_sessions ON refresh_tokens
  USING (tenant_id IS NULL AND nullif(current_setting('app.tenant_id', true), '') IS NULL)
  WITH CHECK (tenant_id IS NULL AND nullif(current_setting('app.tenant_id', true), '') IS NULL);
