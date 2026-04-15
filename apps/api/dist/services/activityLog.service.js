import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
export async function createLog(params) {
    return prisma.activityLog.create({
        data: {
            actingUserId: params.actingUserId,
            actingRole: params.actingRole,
            actionType: params.actionType,
            resourceType: params.resourceType,
            resourceId: params.resourceId,
            previousState: params.previousState !== undefined ? params.previousState : undefined,
            newState: params.newState !== undefined ? params.newState : undefined,
            ipAddress: params.ipAddress,
        },
    });
}
export async function queryLogs(filters) {
    const where = {};
    if (filters.userId)
        where.actingUserId = filters.userId;
    if (filters.actionType)
        where.actionType = filters.actionType;
    if (filters.resourceType)
        where.resourceType = filters.resourceType;
    if (filters.startDate || filters.endDate) {
        const ts = {};
        if (filters.startDate)
            ts.gte = new Date(filters.startDate);
        if (filters.endDate)
            ts.lte = new Date(filters.endDate);
        where.timestamp = ts;
    }
    if (filters.campusId)
        where.Employee = { campusId: filters.campusId };
    return prisma.activityLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        include: { Employee: { select: { id: true, fullName: true, campusId: true } } },
    });
}
/** Activity log entries are immutable — always throws. Validates: Requirements 16.3, 16.6 */
export function updateLog(_id, _data) {
    throw new AppError(403, "ACTIVITY_LOG_IMMUTABLE", "Activity log entries cannot be modified or deleted");
}
export function deleteLog(_id) {
    throw new AppError(403, "ACTIVITY_LOG_IMMUTABLE", "Activity log entries cannot be modified or deleted");
}
//# sourceMappingURL=activityLog.service.js.map