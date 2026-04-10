import { Router } from "express";
import { PERMISSIONS } from "@hrms/shared";
import { requirePermission } from "../middleware/rbac.js";
import { queryLogs } from "../services/activityLog.service.js";

const router = Router();

router.get("/activity-logs", requirePermission(PERMISSIONS.ACTIVITY_LOG_READ), async (req, res) => {
  const { userId, actionType, resourceType, startDate, endDate, campusId } = req.query as Record<string, string | undefined>;
  res.json({ data: await queryLogs({ userId, actionType, resourceType, startDate, endDate, campusId }) });
});

export default router;
