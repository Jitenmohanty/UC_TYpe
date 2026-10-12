import "./config/env.js";
import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { assertRlsRuntimeSafety, prisma } from "./db/prisma.js";
import { bookingsRouter } from "./modules/bookings/bookings.routes.js";
import { accountsRouter, vendorsRouter } from "./modules/accounts/accounts.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { customersRouter } from "./modules/customers/customers.routes.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { driversRouter, vehiclesRouter } from "./modules/fleet/fleet.routes.js";
import { platformRouter } from "./modules/platform/platform.routes.js";
import { reportsRouter } from "./modules/reports/reports.routes.js";
import { teamRouter } from "./modules/team/team.routes.js";

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:3000", credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use("/api", rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false }));

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch {
    res.status(503).json({ status: "unavailable", database: "disconnected" });
  }
});
app.use("/api/auth", authRouter);
app.use("/api/platform", platformRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/vehicles", vehiclesRouter);
app.use("/api/drivers", driversRouter);
app.use("/api/customers", customersRouter);
app.use("/api/vendors", vendorsRouter);
app.use("/api/accounts", accountsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/team", teamRouter);

const errors: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) return res.status(400).json({ error: "Invalid request.", issues: error.issues });
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return res.status(409).json({ error: "A record with those details already exists." });
    if (error.code === "P2025") return res.status(404).json({ error: "Record not found." });
    if (error.code === "P2003") return res.status(400).json({ error: "A related record is invalid." });
    if (error.code === "P2010" && error.meta?.code === "23P01") return res.status(409).json({ error: "The selected vehicle or driver is already assigned during this time." });
  }
  // Avoid leaking SQL, credentials, or internals to callers.
  console.error("request_failed", { name: error instanceof Error ? error.name : "UnknownError" });
  return res.status(500).json({ error: "Something went wrong." });
};
app.use(errors);

const port = Number(process.env.PORT ?? 4000);
void (async () => {
  try {
    await assertRlsRuntimeSafety();
    const server = app.listen(port, () => console.log(`Routewise API listening on ${port}`));
    for (const signal of ["SIGTERM", "SIGINT"] as const) {
      process.on(signal, () => server.close(async () => { await prisma.$disconnect(); process.exit(0); }));
    }
  } catch (error) {
    console.error("api_startup_blocked", { errorName: error instanceof Error ? error.name : "UnknownError" });
    await prisma.$disconnect();
    process.exitCode = 1;
  }
})();
