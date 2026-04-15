import { Router } from "express";
import { PERMISSIONS } from "@hrms/shared";
import { requirePermission } from "../middleware/rbac.js";
import { AppError } from "../middleware/errorHandler.js";
import { getLeaveTypes, getLeaveBalances, submitApplication, approveApplication, rejectApplication, listApplications, } from "../services/leave.service.js";
const router = Router();
function getActor(req) {
    return {
        userId: req.user.userId,
        role: req.user.role,
        specialPrivilege: req.user.specialPrivilege,
        campusId: req.user.campusId,
        ipAddress: req.ip ?? "unknown",
    };
}
router.get("/leave/types", requirePermission(PERMISSIONS.LEAVE_READ), async (_req, res) => {
    res.json({ data: await getLeaveTypes() });
});
router.get("/employees/:id/leave/balances", requirePermission(PERMISSIONS.LEAVE_READ), async (req, res) => {
    const year = req.query.year ? parseInt(req.query.year) : undefined;
    res.json({ data: await getLeaveBalances(req.params.id, year) });
});
router.get("/employees/:id/leave/applications", requirePermission(PERMISSIONS.LEAVE_READ), async (req, res) => {
    res.json({ data: await listApplications(req.params.id) });
});
router.post("/employees/:id/leave/applications", requirePermission(PERMISSIONS.LEAVE_APPLY), async (req, res) => {
    const body = req.body;
    if (!body.leaveTypeId || !body.startDate || !body.endDate || !body.reason) {
        throw new AppError(422, "VALIDATION_ERROR", "leaveTypeId, startDate, endDate, and reason are required");
    }
    const result = await submitApplication(req.params.id, body, getActor(req));
    res.status(201).json({ data: result });
});
router.put("/leave/applications/:id/approve", requirePermission(PERMISSIONS.LEAVE_APPROVE), async (req, res) => {
    res.json({ data: await approveApplication(req.params.id, getActor(req)) });
});
router.put("/leave/applications/:id/reject", requirePermission(PERMISSIONS.LEAVE_REJECT), async (req, res) => {
    const { rejectionReason } = req.body;
    if (!rejectionReason)
        throw new AppError(422, "VALIDATION_ERROR", "rejectionReason is required");
    res.json({ data: await rejectApplication(req.params.id, rejectionReason, getActor(req)) });
});
export default router;
//# sourceMappingURL=leave.router.js.map