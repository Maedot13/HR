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
export declare function createLog(params: CreateLogParams): Promise<{
    id: string;
    actingRole: string;
    actionType: string;
    resourceType: string;
    resourceId: string;
    previousState: import("@prisma/client/runtime/client").JsonValue | null;
    newState: import("@prisma/client/runtime/client").JsonValue | null;
    ipAddress: string;
    timestamp: Date;
    actingUserId: string;
}>;
export declare function queryLogs(filters: LogFilters): Promise<({
    Employee: {
        id: string;
        fullName: string;
        campusId: string;
    };
} & {
    id: string;
    actingRole: string;
    actionType: string;
    resourceType: string;
    resourceId: string;
    previousState: import("@prisma/client/runtime/client").JsonValue | null;
    newState: import("@prisma/client/runtime/client").JsonValue | null;
    ipAddress: string;
    timestamp: Date;
    actingUserId: string;
})[]>;
/** Activity log entries are immutable — always throws. Validates: Requirements 16.3, 16.6 */
export declare function updateLog(_id: string, _data: unknown): never;
export declare function deleteLog(_id: string): never;
//# sourceMappingURL=activityLog.service.d.ts.map