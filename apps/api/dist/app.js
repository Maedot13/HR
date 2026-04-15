import "express-async-errors";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import { authenticate } from "./middleware/auth.js";
import { enforcePasswordChange } from "./middleware/firstLogin.js";
import { errorHandler } from "./middleware/errorHandler.js";
import authRouter from "./routes/auth.router.js";
import orgRouter from "./routes/org.router.js";
import employeeRouter from "./routes/employee.router.js";
import recruitmentRouter from "./routes/recruitment.router.js";
import onboardingRouter from "./routes/onboarding.router.js";
import timetableRouter from "./routes/timetable.router.js";
import leaveRouter from "./routes/leave.router.js";
import appraisalRouter from "./routes/appraisal.router.js";
import trainingRouter from "./routes/training.router.js";
import payrollRouter from "./routes/payroll.router.js";
import clearanceRouter from "./routes/clearance.router.js";
import documentRouter from "./routes/document.router.js";
import activityLogRouter from "./routes/activityLog.router.js";
const app = express();
// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());
// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
    credentials: true,
}));
// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json());
// ── Request ID injection ──────────────────────────────────────────────────────
app.use((req, _res, next) => {
    req.requestId = req.headers["x-request-id"] ?? uuidv4();
    next();
});
// ── Health check (unauthenticated) ────────────────────────────────────────────
app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});
// ── Auth routes — mounted BEFORE authenticate middleware ──────────────────────
// login is fully public; change-password and logout apply authenticate internally.
app.use("/api/v1/auth", authRouter);
// ── Authenticated routes ──────────────────────────────────────────────────────
// All routes below require a valid JWT + password-change enforcement.
app.use("/api/v1", authenticate, enforcePasswordChange, orgRouter);
app.use("/api/v1", authenticate, enforcePasswordChange, employeeRouter);
app.use("/api/v1", authenticate, enforcePasswordChange, recruitmentRouter);
app.use("/api/v1", authenticate, enforcePasswordChange, onboardingRouter);
app.use("/api/v1", authenticate, enforcePasswordChange, timetableRouter);
app.use("/api/v1", authenticate, enforcePasswordChange, leaveRouter);
app.use("/api/v1", authenticate, enforcePasswordChange, appraisalRouter);
app.use("/api/v1", authenticate, enforcePasswordChange, trainingRouter);
app.use("/api/v1", authenticate, enforcePasswordChange, payrollRouter);
app.use("/api/v1", authenticate, enforcePasswordChange, clearanceRouter);
app.use("/api/v1", authenticate, enforcePasswordChange, documentRouter);
app.use("/api/v1", authenticate, enforcePasswordChange, activityLogRouter);
// ── Global error handler (must be last) ──────────────────────────────────────
app.use(errorHandler);
export default app;
//# sourceMappingURL=app.js.map