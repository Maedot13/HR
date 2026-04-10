import { Router } from "express";
import { PERMISSIONS } from "@hrms/shared";
import { requirePermission } from "../middleware/rbac.js";
import { AppError } from "../middleware/errorHandler.js";
import { generateReport, getReport, listReports, exportReport, validateReport } from "../services/payroll.service.js";
import type { ActorContext } from "../services/payroll.service.js";

const router = Router();
function getActor(req: import("express").Request): ActorContext {
  return { userId: req.user.userId, role: req.user.role, specialPrivilege: req.user.specialPrivilege, campusId: req.user.campusId, ipAddress: req.ip ?? "unknown" };
}

router.get("/payroll/reports", requirePermission(PERMISSIONS.PAYROLL_READ), async (_req, res) => {
  res.json({ data: await listReports() });
});

router.post("/payroll/reports", requirePermission(PERMISSIONS.PAYROLL_GENERATE), async (req, res) => {
  const { period } = req.body as { period?: string };
  if (!period) throw new AppError(422, "VALIDATION_ERROR", "period is required");
  res.status(201).json({ data: await generateReport(period, getActor(req)) });
});

router.get("/payroll/reports/:id", requirePermission(PERMISSIONS.PAYROLL_READ), async (req, res) => {
  res.json({ data: await getReport(req.params.id) });
});

router.post("/payroll/reports/:id/export", requirePermission(PERMISSIONS.PAYROLL_EXPORT), async (req, res) => {
  const { format } = req.body as { format?: string };
  if (!format || !["EXCEL", "PDF", "DOCX"].includes(format)) throw new AppError(422, "VALIDATION_ERROR", "format must be EXCEL, PDF, or DOCX");
  res.status(201).json({ data: await exportReport(req.params.id, format as "EXCEL" | "PDF" | "DOCX", getActor(req)) });
});

router.put("/payroll/reports/:id/validate", requirePermission(PERMISSIONS.PAYROLL_VALIDATE), async (req, res) => {
  res.json({ data: await validateReport(req.params.id, getActor(req)) });
});

export default router;
