import { Router } from "express";
import { PERMISSIONS } from "@hrms/shared";
import { requirePermission } from "../middleware/rbac.js";
import { getWorkflow, markDocumentCollected, markAssetAssigned, completeOnboarding, } from "../services/onboarding.service.js";
const router = Router();
function getActor(req) {
    return {
        userId: req.user.userId,
        role: req.user.role,
        campusId: req.user.campusId,
        ipAddress: req.ip ?? "unknown",
    };
}
router.get("/onboarding/:workflowId", requirePermission(PERMISSIONS.ONBOARDING_READ), async (req, res) => {
    res.json({ data: await getWorkflow(req.params.workflowId) });
});
router.put("/onboarding/:workflowId/documents/:docId", requirePermission(PERMISSIONS.ONBOARDING_UPDATE), async (req, res) => {
    res.json({
        data: await markDocumentCollected(req.params.workflowId, req.params.docId, getActor(req)),
    });
});
router.put("/onboarding/:workflowId/assets/:assetId", requirePermission(PERMISSIONS.ONBOARDING_UPDATE), async (req, res) => {
    res.json({
        data: await markAssetAssigned(req.params.workflowId, req.params.assetId, getActor(req)),
    });
});
router.post("/onboarding/:workflowId/complete", requirePermission(PERMISSIONS.ONBOARDING_COMPLETE), async (req, res) => {
    res.json({ data: await completeOnboarding(req.params.workflowId, getActor(req)) });
});
export default router;
//# sourceMappingURL=onboarding.router.js.map