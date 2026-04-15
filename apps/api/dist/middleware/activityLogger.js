import { prisma } from "../lib/prisma.js";
/**
 * Async helper that writes an ActivityLog row after every state-changing operation.
 *
 * This is NOT an Express middleware — it is called explicitly by service functions
 * after performing state-changing operations. Errors are caught and logged to
 * stderr so that a logging failure never breaks the primary operation.
 *
 * @example
 * await logActivity({
 *   actingUserId: req.user.userId,
 *   actingRole: req.user.role,
 *   actionType: "LEAVE_APPROVED",
 *   resourceType: "LeaveApplication",
 *   resourceId: application.id,
 *   previousState: { status: "PENDING" },
 *   newState: { status: "APPROVED" },
 *   ipAddress: req.ip ?? "unknown",
 * });
 */
export async function logActivity(params) {
    try {
        await prisma.activityLog.create({
            data: {
                actingUserId: params.actingUserId,
                actingRole: params.actingRole,
                actionType: params.actionType,
                resourceType: params.resourceType,
                resourceId: params.resourceId,
                previousState: params.previousState !== undefined
                    ? params.previousState
                    : undefined,
                newState: params.newState !== undefined
                    ? params.newState
                    : undefined,
                ipAddress: params.ipAddress,
            },
        });
    }
    catch (err) {
        // Activity logging must never break the primary operation
        console.error("[ActivityLogger] Failed to write activity log:", err);
    }
}
//# sourceMappingURL=activityLogger.js.map