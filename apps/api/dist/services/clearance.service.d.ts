export interface ActorContext {
    userId: string;
    role: string;
    specialPrivilege?: string;
    campusId: string;
    ipAddress: string;
}
export declare function configureBodies(data: {
    name: string;
    approvalMode: "SEQUENTIAL" | "PARALLEL";
    order: number;
}[], actor: ActorContext): Promise<{
    id: string;
    name: string;
    approvalMode: import("@prisma/client").$Enums.ApprovalMode;
    order: number;
}[]>;
export declare function listBodies(): Promise<{
    id: string;
    name: string;
    approvalMode: import("@prisma/client").$Enums.ApprovalMode;
    order: number;
}[]>;
export declare function updateBody(id: string, data: Partial<{
    name: string;
    approvalMode: "SEQUENTIAL" | "PARALLEL";
    order: number;
}>, actor: ActorContext): Promise<{
    id: string;
    name: string;
    approvalMode: import("@prisma/client").$Enums.ApprovalMode;
    order: number;
}>;
export declare function initiateClearance(employeeId: string, actor: ActorContext): Promise<{
    id: string;
    employeeId: string;
    status: import("@prisma/client").$Enums.ClearanceStatus;
    initiatedAt: Date;
    completedAt: Date | null;
}>;
export declare function approveTask(taskId: string, actor: ActorContext): Promise<{
    id: string;
    status: import("@prisma/client").$Enums.ClearanceTaskStatus;
    updatedAt: Date;
    rejectionReason: string | null;
    approvedBy: string | null;
    approvedAt: Date | null;
    clearanceRecordId: string;
    clearanceBodyId: string;
}>;
export declare function rejectTask(taskId: string, rejectionReason: string, actor: ActorContext): Promise<{
    id: string;
    status: import("@prisma/client").$Enums.ClearanceTaskStatus;
    updatedAt: Date;
    rejectionReason: string | null;
    approvedBy: string | null;
    approvedAt: Date | null;
    clearanceRecordId: string;
    clearanceBodyId: string;
}>;
export declare function getClearanceRecord(employeeId: string): Promise<{
    ClearanceTask: ({
        ClearanceBody: {
            id: string;
            name: string;
            approvalMode: import("@prisma/client").$Enums.ApprovalMode;
            order: number;
        };
    } & {
        id: string;
        status: import("@prisma/client").$Enums.ClearanceTaskStatus;
        updatedAt: Date;
        rejectionReason: string | null;
        approvedBy: string | null;
        approvedAt: Date | null;
        clearanceRecordId: string;
        clearanceBodyId: string;
    })[];
} & {
    id: string;
    employeeId: string;
    status: import("@prisma/client").$Enums.ClearanceStatus;
    initiatedAt: Date;
    completedAt: Date | null;
}>;
//# sourceMappingURL=clearance.service.d.ts.map