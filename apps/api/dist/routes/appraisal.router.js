import { Router } from "express";
import { PERMISSIONS } from "@hrms/shared";
import { requirePermission } from "../middleware/rbac.js";
import { AppError } from "../middleware/errorHandler.js";
import { createEvaluation, getEvaluation, updateEvaluation, listEvaluations } from "../services/appraisal.service.js";
const router = Router();
function getActor(req) {
    return { userId: req.user.userId, role: req.user.role, specialPrivilege: req.user.specialPrivilege, campusId: req.user.campusId, ipAddress: req.ip ?? "unknown" };
}
router.get("/employees/:id/evaluations", requirePermission(PERMISSIONS.EVALUATION_READ), async (req, res) => {
    res.json({ data: await listEvaluations(req.params.id) });
});
router.post("/employees/:id/evaluations", requirePermission(PERMISSIONS.EVALUATION_CREATE), async (req, res) => {
    const b = req.body;
    if (!b.evaluationPeriod || b.efficiencyScore === undefined || b.workOutputScore === undefined)
        throw new AppError(422, "VALIDATION_ERROR", "evaluationPeriod, efficiencyScore, and workOutputScore are required");
    res.status(201).json({ data: await createEvaluation(req.params.id, b, getActor(req)) });
});
router.get("/evaluations/:id", requirePermission(PERMISSIONS.EVALUATION_READ), async (req, res) => {
    res.json({ data: await getEvaluation(req.params.id) });
});
router.put("/evaluations/:id", requirePermission(PERMISSIONS.EVALUATION_UPDATE), async (req, res) => {
    res.json({ data: await updateEvaluation(req.params.id, req.body, getActor(req)) });
});
export default router;
//# sourceMappingURL=appraisal.router.js.map