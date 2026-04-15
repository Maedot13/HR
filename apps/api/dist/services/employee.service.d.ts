import type { BaseRole, SpecialPrivilege } from "@hrms/shared";
export interface ActorContext {
    userId: string;
    role: string;
    campusId: string;
    ipAddress: string;
}
export interface CreateEmployeeData {
    campusId: string;
    fullName?: string | null;
    dateOfBirth?: string | null;
    gender?: string | null;
    nationality?: string | null;
    contactInfo?: object | null;
    emergencyContact?: object | null;
    academicRank?: string | null;
    departmentId?: string | null;
    unitId?: string | null;
    hireDate?: string | null;
}
export interface UpdateEmployeeData {
    fullName?: string | null;
    dateOfBirth?: string | null;
    gender?: string | null;
    nationality?: string | null;
    contactInfo?: object | null;
    emergencyContact?: object | null;
    academicRank?: string | null;
    departmentId?: string | null;
    unitId?: string | null;
    hireDate?: string | null;
}
/**
 * Create a new employee record.
 * Auto-generates a temp password (hashed with bcrypt cost 12) and an employeeId.
 * Creates a UserRole record with baseRole=EMPLOYEE.
 */
export declare function createEmployee(data: CreateEmployeeData, actor: ActorContext): Promise<{
    tempPassword: string;
    id: string;
    employeeId: string;
    email: string;
    fullName: string;
    dateOfBirth: Date;
    gender: import("@prisma/client").$Enums.Gender;
    nationality: string;
    contactInfo: import("@prisma/client/runtime/client").JsonValue;
    emergencyContact: import("@prisma/client/runtime/client").JsonValue;
    academicRank: import("@prisma/client").$Enums.AcademicRank | null;
    status: import("@prisma/client").$Enums.EmployeeStatus;
    campusId: string;
    departmentId: string | null;
    unitId: string | null;
    hireDate: Date | null;
    endDate: Date | null;
    passwordHash: string;
    isTempPassword: boolean;
    createdAt: Date;
    updatedAt: Date;
}>;
/**
 * Fetch a single employee by internal UUID, including their userRole.
 * Throws 404 if not found.
 */
export declare function getEmployee(id: string): Promise<{
    UserRole: {
        id: string;
        employeeId: string;
        updatedAt: Date;
        baseRole: import("@prisma/client").$Enums.BaseRole;
        specialPrivilege: import("@prisma/client").$Enums.SpecialPrivilege | null;
    } | null;
} & {
    id: string;
    employeeId: string;
    email: string;
    fullName: string;
    dateOfBirth: Date;
    gender: import("@prisma/client").$Enums.Gender;
    nationality: string;
    contactInfo: import("@prisma/client/runtime/client").JsonValue;
    emergencyContact: import("@prisma/client/runtime/client").JsonValue;
    academicRank: import("@prisma/client").$Enums.AcademicRank | null;
    status: import("@prisma/client").$Enums.EmployeeStatus;
    campusId: string;
    departmentId: string | null;
    unitId: string | null;
    hireDate: Date | null;
    endDate: Date | null;
    passwordHash: string;
    isTempPassword: boolean;
    createdAt: Date;
    updatedAt: Date;
}>;
/**
 * List employees with optional filters.
 */
export declare function listEmployees(filters?: {
    campusId?: string;
    status?: string;
    search?: string;
}): Promise<({
    UserRole: {
        id: string;
        employeeId: string;
        updatedAt: Date;
        baseRole: import("@prisma/client").$Enums.BaseRole;
        specialPrivilege: import("@prisma/client").$Enums.SpecialPrivilege | null;
    } | null;
} & {
    id: string;
    employeeId: string;
    email: string;
    fullName: string;
    dateOfBirth: Date;
    gender: import("@prisma/client").$Enums.Gender;
    nationality: string;
    contactInfo: import("@prisma/client/runtime/client").JsonValue;
    emergencyContact: import("@prisma/client/runtime/client").JsonValue;
    academicRank: import("@prisma/client").$Enums.AcademicRank | null;
    status: import("@prisma/client").$Enums.EmployeeStatus;
    campusId: string;
    departmentId: string | null;
    unitId: string | null;
    hireDate: Date | null;
    endDate: Date | null;
    passwordHash: string;
    isTempPassword: boolean;
    createdAt: Date;
    updatedAt: Date;
})[]>;
/**
 * Update allowed employee fields.
 * Writes an EmploymentHistory row if position/department/status changes.
 */
export declare function updateEmployee(id: string, data: UpdateEmployeeData, actor: ActorContext): Promise<{
    id: string;
    employeeId: string;
    email: string;
    fullName: string;
    dateOfBirth: Date;
    gender: import("@prisma/client").$Enums.Gender;
    nationality: string;
    contactInfo: import("@prisma/client/runtime/client").JsonValue;
    emergencyContact: import("@prisma/client/runtime/client").JsonValue;
    academicRank: import("@prisma/client").$Enums.AcademicRank | null;
    status: import("@prisma/client").$Enums.EmployeeStatus;
    campusId: string;
    departmentId: string | null;
    unitId: string | null;
    hireDate: Date | null;
    endDate: Date | null;
    passwordHash: string;
    isTempPassword: boolean;
    createdAt: Date;
    updatedAt: Date;
}>;
/**
 * Activate an employee profile.
 * Validates all mandatory fields are non-null/non-empty.
 * Throws 422 INCOMPLETE_PROFILE with list of missing fields if any are absent.
 */
export declare function activateEmployee(id: string, actor: ActorContext): Promise<{
    id: string;
    employeeId: string;
    email: string;
    fullName: string;
    dateOfBirth: Date;
    gender: import("@prisma/client").$Enums.Gender;
    nationality: string;
    contactInfo: import("@prisma/client/runtime/client").JsonValue;
    emergencyContact: import("@prisma/client/runtime/client").JsonValue;
    academicRank: import("@prisma/client").$Enums.AcademicRank | null;
    status: import("@prisma/client").$Enums.EmployeeStatus;
    campusId: string;
    departmentId: string | null;
    unitId: string | null;
    hireDate: Date | null;
    endDate: Date | null;
    passwordHash: string;
    isTempPassword: boolean;
    createdAt: Date;
    updatedAt: Date;
}>;
/**
 * Upload a document for an employee.
 */
export declare function uploadDocument(employeeId: string, documentType: string, fileUrl: string, actor: ActorContext): Promise<{
    id: string;
    fileUrl: string;
    employeeId: string;
    documentType: string;
    uploadedAt: Date;
    uploadedBy: string;
}>;
/**
 * List all documents for an employee.
 */
export declare function listDocuments(employeeId: string): Promise<{
    id: string;
    fileUrl: string;
    employeeId: string;
    documentType: string;
    uploadedAt: Date;
    uploadedBy: string;
}[]>;
/**
 * Get employment history for an employee.
 */
export declare function getEmploymentHistory(employeeId: string): Promise<{
    id: string;
    employeeId: string;
    changedAt: Date;
    changeType: string;
    previousValue: string | null;
    newValue: string;
    changedBy: string;
}[]>;
/**
 * Assign (upsert) a base role to an employee.
 */
export declare function assignRole(employeeId: string, baseRole: BaseRole, actor: ActorContext): Promise<{
    id: string;
    employeeId: string;
    updatedAt: Date;
    baseRole: import("@prisma/client").$Enums.BaseRole;
    specialPrivilege: import("@prisma/client").$Enums.SpecialPrivilege | null;
}>;
/**
 * Assign (upsert) a special privilege to an employee.
 */
export declare function assignPrivilege(employeeId: string, specialPrivilege: SpecialPrivilege | null, actor: ActorContext): Promise<{
    id: string;
    employeeId: string;
    updatedAt: Date;
    baseRole: import("@prisma/client").$Enums.BaseRole;
    specialPrivilege: import("@prisma/client").$Enums.SpecialPrivilege | null;
}>;
/**
 * Get effective permissions for an employee.
 */
export declare function getPermissions(employeeId: string): Promise<unknown[]>;
//# sourceMappingURL=employee.service.d.ts.map