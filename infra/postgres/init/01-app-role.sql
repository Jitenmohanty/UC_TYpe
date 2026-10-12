-- Local runtime role. Migrations use the separate postgres superuser URL.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'routewise_app') THEN
    CREATE ROLE routewise_app LOGIN PASSWORD 'routewise_app_dev' NOSUPERUSER NOBYPASSRLS;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE routewise TO routewise_app;
GRANT USAGE ON SCHEMA public TO routewise_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO routewise_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO routewise_app;
