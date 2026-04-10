import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";

export interface CreateLogParams {
  actingUserId: string;
  actingRole: string;
  actionType: string;
  resourceType: string;
  resourceId: string;
  previousState?: unknown;
  newState?: unknown;
  ipAddress: string;
}

export interface LogFilters {
  userId?: string;
  actionType?: string;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
  campusId?: string;
}

export async function createLog(params: CreateLogParams) {
  return prisma.activityLog.create({
    data: {
      actingUserId: params.actingUserId,
      actingRole: params.actingRole,
      actionType: params.actionType,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      previousState: params.previousState !== undefined ? (params.previousState as object) : undefined,
      newState: params.newState !== undefined ? (params.newState as object) : undefined,
      ipAddress: params.ipAddress,
    },
  });
}

export async function queryLogs(filters: LogFilters) {
  const where: Record<string, unknown> = {};
  if (filters.userId) where.actingUserId = filters.userId;
  if (filters.actionType) where.actionType = filters.actionType;
  if (filters.resourceType) where.resourceType = filters.resourceType;
  if (filters.startDate || filters.endDate) {
    const ts: Record<string, Date> = {};
    if (filters.startDate) ts.gte = new Date(filters.startDate);
    if (filters.endDate) ts.lte = new Date(filters.endDate);
    where.timestamp = ts;
  }
  if (filters.campusId) where.Employee = { campusId: filters.campusId };

  return prisma.activityLog.findMany({
    where,
    orderBy: { timestamp: "desc" },
    include: { Employee: { select: { id: true, fullName: true, campusId: true } } },
  });
}

/** Activity log entries are immutable — always throws. Validates: Requirements 16.3, 16.6 */
export function updateLog(_id: string, _data: unknown): never {
  throw new AppError(403, "ACTIVITY_LOG_IMMUTABLE", "Activity log entries cannot be modified or deleted");
}

export function deleteLog(_id: string): never {
  throw new AppError(403, "ACTIVITY_LOG_IMMUTABLE", "Activity log entries cannot be modified or deleted");
}
