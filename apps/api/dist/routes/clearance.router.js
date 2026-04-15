import { Router } from "express";
import { PERMISSIONS } from "@hrms/shared";
import { requirePermission } from "../middleware/rbac.js";
import { AppError } from "../middleware/errorHandler.js";
import { configureBodies, listBodies, updateBody, initiateClearance, approveTask, rejectTask, getClearanceRecord } from "../services/clearance.service.js";
const router = Router();
function getActor(req) {
    return { userId: req.user.userId, role: req.user.role, specialPrivilege: req.user.specialPrivilege, campusId: req.user.campusId, ipAddress: req.ip ?? "unknown" };
}
router.get("/clearance/bodies", requirePermission(PERMISSIONS.CLEARANCE_BODY_CONFIGURE), async (_req, res) => {
    res.json({ data: await listBodies() });
});
router.post("/clearance/bodies", requirePermission(PERMISSIONS.CLEARANCE_BODY_CONFIGURE), async (req, res) => {
    const bodies = req.body;
    if (!Array.isArray(bodies) || bodies.length === 0)
        throw new AppError(422, "VALIDATION_ERROR", "Request body must be a non-empty array");
    res.status(201).json({ data: await configureBodies(bodies, getActor(req)) });
});
router.put("/clearance/bodies/:id", requirePermission(PERMISSIONS.CLEARANCE_BODY_CONFIGURE), async (req, res) => {
    res.json({ data: await updateBody(req.params.id, req.body, getActor(req)) });
});
router.post("/employees/:id/clearance", requirePermission(PERMISSIONS.CLEARANCE_INITIATE), async (req, res) => {
    res.status(201).json({ data: await initiateClearance(req.params.id, getActor(req)) });
});
router.get("/employees/:id/clearance", requirePermission(PERMISSIONS.CLEARANCE_READ), async (req, res) => {
    res.json({ data: await getClearanceRecord(req.params.id) });
});
router.put("/clearance/tasks/:id/approve", requirePermission(PERMISSIONS.CLEARANCE_TASK_APPROVE), async (req, res) => {
    res.json({ data: await approveTask(req.params.id, getActor(req)) });
});
router.put("/clearance/tasks/:id/reject", requirePermission(PERMISSIONS.CLEARANCE_TASK_REJECT), async (req, res) => {
    const { rejectionReason } = req.body;
    if (!rejectionReason)
        throw new AppError(422, "VALIDATION_ERROR", "rejectionReason is required");
    res.json({ data: await rejectTask(req.params.id, rejectionReason, getActor(req)) });
});
export default router;
//# sourceMappingURL=clearance.router.js.map