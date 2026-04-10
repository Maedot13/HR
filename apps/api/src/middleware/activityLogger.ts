import { prisma } from "../lib/prisma.js";
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
export async function logActivity(params: ActivityLogParams): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        actingUserId: params.actingUserId,
        actingRole: params.actingRole,
        actionType: params.actionType,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        previousState:
          params.previousState !== undefined
            ? (params.previousState as object)
            : undefined,
        newState:
          params.newState !== undefined
            ? (params.newState as object)
            : undefined,
        ipAddress: params.ipAddress,
      },
    });
  } catch (err) {
    // Activity logging must never break the primary operation
    console.error("[ActivityLogger] Failed to write activity log:", err);
  }
}
