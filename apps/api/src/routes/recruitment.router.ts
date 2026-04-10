import { Router } from "express";
import { PERMISSIONS } from "@hrms/shared";
import { requirePermission } from "../middleware/rbac.js";
import { AppError } from "../middleware/errorHandler.js";
import {
  createPosting,
  listPostings,
  getPosting,
  updatePosting,
  submitApplication,
  advanceStage,
  issueOffer,
} from "../services/recruitment.service.js";
import type { ActorContext } from "../services/recruitment.service.js";

const router = Router();

function getActor(req: import("express").Request): ActorContext {
  return { userId: req.user.userId, role: req.user.role, ipAddress: req.ip ?? "unknown" };
}

router.get("/job-postings", requirePermission(PERMISSIONS.JOB_POSTING_READ), async (req, res) => {
  const { type, isAcademic } = req.query as Record<string, string | undefined>;
  res.json({ data: await listPostings({ type, isAcademic: isAcademic !== undefined ? isAcademic === "true" : undefined }) });
});

router.post("/job-postings", requirePermission(PERMISSIONS.JOB_POSTING_CREATE), async (req, res) => {
  const b = req.body as Record<string, unknown>;
  if (!b.type || !b.title || !b.description || !b.requirements || !b.deadline)
    throw new AppError(422, "VALIDATION_ERROR", "type, title, description, requirements, and deadline are required");
  res.status(201).json({ data: await createPosting(b as Parameters<typeof createPosting>[0], getActor(req)) });
});

router.get("/job-postings/:id", requirePermission(PERMISSIONS.JOB_POSTING_READ), async (req, res) => {
  res.json({ data: await getPosting(req.params.id) });
});

router.put("/job-postings/:id", requirePermission(PERMISSIONS.JOB_POSTING_UPDATE), async (req, res) => {
  res.json({ data: await updatePosting(req.params.id, req.body as Parameters<typeof updatePosting>[1], getActor(req)) });
});

router.get("/job-postings/:id/applications", requirePermission(PERMISSIONS.JOB_POSTING_READ), async (req, res) => {
  const posting = await getPosting(req.params.id);
  res.json({ data: posting.applications });
});

router.post("/job-postings/:id/applications", requirePermission(PERMISSIONS.APPLICATION_SUBMIT), async (req, res) => {
  const { candidateName, candidateEmail } = req.body as { candidateName?: string; candidateEmail?: string };
  if (!candidateName || !candidateEmail)
    throw new AppError(422, "VALIDATION_ERROR", "candidateName and candidateEmail are required");
  res.status(201).json({ data: await submitApplication(req.params.id, { candidateName, candidateEmail }, getActor(req)) });
});

router.put("/applications/:id/advance", requirePermission(PERMISSIONS.APPLICATION_ADVANCE), async (req, res) => {
  const { publicationEvalScore } = req.body as { publicationEvalScore?: number };
  res.json({ data: await advanceStage(req.params.id, { publicationEvalScore }, getActor(req)) });
});

router.post("/applications/:id/offer", requirePermission(PERMISSIONS.APPLICATION_OFFER), async (req, res) => {
  const { notes } = req.body as { notes?: string };
  res.json({ data: await issueOffer(req.params.id, { notes }, getActor(req)) });
});

export default router;
