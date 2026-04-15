export interface ActorContext {
    userId: string;
    role: string;
    specialPrivilege?: string;
    campusId: string;
    ipAddress: string;
}
/** Annual leave entitlement: min(19 + yearsOfService, 30) */
export declare function annualLeaveEntitlement(years: number): number;
export declare function getLeaveTypes(): Promise<{
    id: string;
    name: import("@prisma/client").$Enums.LeaveTypeName;
    description: string;
    maxDays: number | null;
    payRate: number;
}[]>;
export declare function getLeaveBalances(employeeId: string, year?: number): Promise<({
    LeaveType: {
        id: string;
        name: import("@prisma/client").$Enums.LeaveTypeName;
        description: string;
        maxDays: number | null;
        payRate: number;
    };
} & {
    id: string;
    employeeId: string;
    leaveTypeId: string;
    balance: number;
    year: number;
})[]>;
export declare function submitApplication(employeeId: string, data: {
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    reason: string;
    supportingDocs?: string[];
}, actor: ActorContext): Promise<{
    requiresApproval: boolean;
    id: string;
    employeeId: string;
    status: import("@prisma/client").$Enums.LeaveStatus;
    endDate: Date;
    createdAt: Date;
    startDate: Date;
    reason: string;
    rejectionReason: string | null;
    approvedBy: string | null;
    approvedAt: Date | null;
    supportingDocs: string[];
    leaveTypeId: string;
}>;
export declare function approveApplication(applicationId: string, actor: ActorContext): Promise<{
    id: string;
    employeeId: string;
    status: import("@prisma/client").$Enums.LeaveStatus;
    endDate: Date;
    createdAt: Date;
    startDate: Date;
    reason: string;
    rejectionReason: string | null;
    approvedBy: string | null;
    approvedAt: Date | null;
    supportingDocs: string[];
    leaveTypeId: string;
}>;
export declare function rejectApplication(applicationId: string, rejectionReason: string, actor: ActorContext): Promise<{
    id: string;
    employeeId: string;
    status: import("@prisma/client").$Enums.LeaveStatus;
    endDate: Date;
    createdAt: Date;
    startDate: Date;
    reason: string;
    rejectionReason: string | null;
    approvedBy: string | null;
    approvedAt: Date | null;
    supportingDocs: string[];
    leaveTypeId: string;
}>;
export declare function listApplications(employeeId: string): Promise<({
    LeaveType: {
        id: string;
        name: import("@prisma/client").$Enums.LeaveTypeName;
        description: string;
        maxDays: number | null;
        payRate: number;
    };
} & {
    id: string;
    employeeId: string;
    status: import("@prisma/client").$Enums.LeaveStatus;
    endDate: Date;
    createdAt: Date;
    startDate: Date;
    reason: string;
    rejectionReason: string | null;
    approvedBy: string | null;
    approvedAt: Date | null;
    supportingDocs: string[];
    leaveTypeId: string;
})[]>;
//# sourceMappingURL=leave.service.d.ts.map