import { Router } from "express";
import { PERMISSIONS } from "@hrms/shared";
import { requirePermission } from "../middleware/rbac.js";
import { AppError } from "../middleware/errorHandler.js";
import { createProgram, listPrograms, assignTraining, completeTraining, getSkillGapReport } from "../services/training.service.js";
const router = Router();
function getActor(req) {
    return { userId: req.user.userId, role: req.user.role, specialPrivilege: req.user.specialPrivilege, campusId: req.user.campusId, ipAddress: req.ip ?? "unknown" };
}
router.get("/training/programs", requirePermission(PERMISSIONS.TRAINING_READ), async (_req, res) => {
    res.json({ data: await listPrograms() });
});
router.post("/training/programs", requirePermission(PERMISSIONS.TRAINING_CREATE), async (req, res) => {
    const b = req.body;
    if (!b.title || !b.description)
        throw new AppError(422, "VALIDATION_ERROR", "title and description are required");
    res.status(201).json({ data: await createProgram({ title: b.title, description: b.description, competencies: b.competencies ?? [] }, getActor(req)) });
});
router.post("/employees/:id/training", requirePermission(PERMISSIONS.TRAINING_ASSIGN), async (req, res) => {
    const b = req.body;
    if (!b.trainingProgramId || !b.expectedCompletion)
        throw new AppError(422, "VALIDATION_ERROR", "trainingProgramId and expectedCompletion are required");
    res.status(201).json({ data: await assignTraining(req.params.id, b, getActor(req)) });
});
router.put("/training/assignments/:id/complete", requirePermission(PERMISSIONS.TRAINING_COMPLETE), async (req, res) => {
    res.json({ data: await completeTraining(req.params.id, getActor(req)) });
});
router.get("/employees/:id/skill-gap", requirePermission(PERMISSIONS.TRAINING_READ), async (req, res) => {
    res.json({ data: await getSkillGapReport(req.params.id) });
});
export default router;
//# sourceMappingURL=training.router.js.map