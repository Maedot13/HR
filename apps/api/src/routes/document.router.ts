import { Router } from "express";
import { PERMISSIONS } from "@hrms/shared";
import { requirePermission } from "../middleware/rbac.js";
import { AppError } from "../middleware/errorHandler.js";
import { generateExperienceLetter, listExperienceLetters } from "../services/document.service.js";
import type { ActorContext } from "../services/document.service.js";

const router = Router();
function getActor(req: import("express").Request): ActorContext {
  return { userId: req.user.userId, role: req.user.role, specialPrivilege: req.user.specialPrivilege, campusId: req.user.campusId, ipAddress: req.ip ?? "unknown" };
}

router.post("/employees/:id/experience-letter", requirePermission(PERMISSIONS.EXPERIENCE_LETTER_GENERATE), async (req, res) => {
  const { format } = req.body as { format?: string };
  if (!format || !["PDF", "DOCX"].includes(format)) throw new AppError(422, "VALIDATION_ERROR", "format must be PDF or DOCX");
  res.status(201).json({ data: await generateExperienceLetter(req.params.id, format as "PDF" | "DOCX", getActor(req)) });
});

router.get("/employees/:id/experience-letters", requirePermission(PERMISSIONS.EXPERIENCE_LETTER_READ), async (req, res) => {
  res.json({ data: await listExperienceLetters(req.params.id) });
});

export default router;
