import type { BaseRole } from "@hrms/shared";
export interface ActivityLogParams {
    actingUserId: string;
    actingRole: BaseRole | string;
    actionType: string;
    resourceType: string;
    resourceId: string;
    previousState?: unknown;
    newState?: unknown;
    ipAddress: string;
}
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
export declare function logActivity(params: ActivityLogParams): Promise<void>;
//# sourceMappingURL=activityLogger.d.ts.map