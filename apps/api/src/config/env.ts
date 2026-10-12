import dotenv from "dotenv";
import { resolve } from "node:path";

// Workspace scripts run from apps/api, while the shared development env file stays at repo root.
dotenv.config({ path: resolve(process.cwd(), "../../.env") });
