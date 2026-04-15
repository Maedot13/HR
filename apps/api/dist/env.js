import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
// Resolve .env relative to the workspace root (4 levels up from apps/api/src/env.ts)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../../../.env");
dotenv.config({ path: envPath });
//# sourceMappingURL=env.js.map