import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { logActivity } from "../middleware/activityLogger.js";
import { hashPassword } from "./auth.service.js";
import { generate } from "./employeeId.service.js";
import { computeEffectivePermissions } from "@hrms/shared";
// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Generate a random 8-character alphanumeric temp password */
function generateTempPassword() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
// ─── Mandatory fields for activation ─────────────────────────────────────────
const MANDATORY_FIELDS = [
    "fullName",
    "dateOfBirth",
    "gender",
    "nationality",
    "contactInfo",
    "emergencyContact",
];
// ─── Service functions ────────────────────────────────────────────────────────
/**
 * Create a new employee record.
 * Auto-generates a temp password (hashed with bcrypt cost 12) and an employeeId.
 * Creates a UserRole record with baseRole=EMPLOYEE.
 */
export async function createEmployee(data, actor) {
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    const year = new Date().getFullYear();
    const employeeId = await generate(data.campusId, year);
    const employee = await prisma.employee.create({
        data: {
            employeeId,
            campusId: data.campusId,
            fullName: data.fullName ?? "",
            dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : new Date("1970-01-01"),
            gender: data.gender ?? "MALE",
            nationality: data.nationality ?? "",
            contactInfo: data.contactInfo ?? {},
            emergencyContact: data.emergencyContact ?? {},
            academicRank: (data.academicRank || undefined),
            departmentId: data.departmentId || undefined,
            unitId: data.unitId || undefined,
            hireDate: data.hireDate ? new Date(data.hireDate) : undefined,
            passwordHash,
            isTempPassword: true,
            status: "PENDING",
            email: data.contactInfo?.email || `${employeeId.toLowerCase()}@bdu.edu.et`,
        },
    });
    await prisma.userRole.create({
        data: {
            employeeId: employee.id,
            baseRole: "EMPLOYEE",
        },
    });
    await logActivity({
        actingUserId: actor.userId,
        actingRole: actor.role,
        actionType: "EMPLOYEE_CREATED",
        resourceType: "Employee",
        resourceId: employee.id,
        newState: { employeeId: employee.employeeId, status: employee.status },
        ipAddress: actor.ipAddress,
    });
    return { ...employee, tempPassword };
}
/**
 * Fetch a single employee by internal UUID, including their userRole.
 * Throws 404 if not found.
 */
export async function getEmployee(id) {
    const employee = await prisma.employee.findUnique({
        where: { id },
        include: { UserRole: true },
    });
    if (!employee)
        throw new AppError(404, "NOT_FOUND", "Employee not found");
    return employee;
}
/**
 * List employees with optional filters.
 */
export async function listEmployees(filters) {
    return prisma.employee.findMany({
        where: {
            ...(filters?.campusId ? { campusId: filters.campusId } : {}),
            ...(filters?.status ? { status: filters.status } : {}),
            ...(filters?.search
                ? {
                    OR: [
                        { fullName: { contains: filters.search, mode: "insensitive" } },
                        { employeeId: { contains: filters.search, mode: "insensitive" } },
                    ],
                }
                : {}),
        },
        include: { UserRole: true },
        orderBy: { createdAt: "desc" },
    });
}
/**
 * Update allowed employee fields.
 * Writes an EmploymentHistory row if position/department/status changes.
 */
export async function updateEmployee(id, data, actor) {
    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing)
        throw new AppError(404, "NOT_FOUND", "Employee not found");
    const updateData = {};
    if (data.fullName !== undefined)
        updateData.fullName = data.fullName;
    if (data.dateOfBirth !== undefined)
        updateData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
    if (data.gender !== undefined)
        updateData.gender = data.gender;
    if (data.nationality !== undefined)
        updateData.nationality = data.nationality;
    if (data.contactInfo !== undefined)
        updateData.contactInfo = data.contactInfo;
    if (data.emergencyContact !== undefined)
        updateData.emergencyContact = data.emergencyContact;
    if (data.academicRank !== undefined)
        updateData.academicRank = data.academicRank || null;
    if (data.departmentId !== undefined)
        updateData.departmentId = data.departmentId || null;
    if (data.unitId !== undefined)
        updateData.unitId = data.unitId || null;
    if (data.hireDate !== undefined)
        updateData.hireDate = data.hireDate ? new Date(data.hireDate) : null;
    const updated = await prisma.employee.update({
        where: { id },
        data: updateData,
    });
    // Write EmploymentHistory rows for tracked changes
    const historyEntries = [];
    if (data.departmentId !== undefined &&
        data.departmentId !== existing.departmentId) {
        historyEntries.push({
            changeType: "department",
            previousValue: existing.departmentId ?? null,
            newValue: data.departmentId ?? "",
        });
    }
    if (historyEntries.length > 0) {
        await prisma.employmentHistory.createMany({
            data: historyEntries.map((entry) => ({
                employeeId: id,
                changeType: entry.changeType,
                previousValue: entry.previousValue,
                newValue: entry.newValue,
                changedBy: actor.userId,
            })),
        });
    }
    await logActivity({
        actingUserId: actor.userId,
        actingRole: actor.role,
        actionType: "EMPLOYEE_UPDATED",
        resourceType: "Employee",
        resourceId: id,
        previousState: existing,
        newState: updated,
        ipAddress: actor.ipAddress,
    });
    return updated;
}
/**
 * Activate an employee profile.
 * Validates all mandatory fields are non-null/non-empty.
 * Throws 422 INCOMPLETE_PROFILE with list of missing fields if any are absent.
 */
export async function activateEmployee(id, actor) {
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee)
        throw new AppError(404, "NOT_FOUND", "Employee not found");
    const missingFields = [];
    for (const field of MANDATORY_FIELDS) {
        const value = employee[field];
        if (value === null || value === undefined || value === "") {
            missingFields.push(field);
        }
        else if (value instanceof Date
            ? false
            : typeof value === "object" &&
                !Array.isArray(value) &&
                Object.keys(value).length === 0) {
            // Empty plain object counts as missing for contactInfo / emergencyContact
            missingFields.push(field);
        }
    }
    if (missingFields.length > 0) {
        throw new AppError(422, "INCOMPLETE_PROFILE", "Cannot activate employee: mandatory profile fields are missing", { missingFields });
    }
    const updated = await prisma.employee.update({
        where: { id },
        data: { status: "ACTIVE" },
    });
    await prisma.employmentHistory.create({
        data: {
            employeeId: id,
            changeType: "status",
            previousValue: employee.status,
            newValue: "ACTIVE",
            changedBy: actor.userId,
        },
    });
    await logActivity({
        actingUserId: actor.userId,
        actingRole: actor.role,
        actionType: "EMPLOYEE_ACTIVATED",
        resourceType: "Employee",
        resourceId: id,
        previousState: { status: employee.status },
        newState: { status: "ACTIVE" },
        ipAddress: actor.ipAddress,
    });
    return updated;
}
/**
 * Upload a document for an employee.
 */
export async function uploadDocument(employeeId, documentType, fileUrl, actor) {
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee)
        throw new AppError(404, "NOT_FOUND", "Employee not found");
    const doc = await prisma.employeeDocument.create({
        data: {
            employeeId,
            documentType,
            fileUrl,
            uploadedBy: actor.userId,
        },
    });
    await logActivity({
        actingUserId: actor.userId,
        actingRole: actor.role,
        actionType: "EMPLOYEE_DOCUMENT_UPLOADED",
        resourceType: "EmployeeDocument",
        resourceId: doc.id,
        newState: { documentType, fileUrl },
        ipAddress: actor.ipAddress,
    });
    return doc;
}
/**
 * List all documents for an employee.
 */
export async function listDocuments(employeeId) {
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee)
        throw new AppError(404, "NOT_FOUND", "Employee not found");
    return prisma.employeeDocument.findMany({
        where: { employeeId },
        orderBy: { uploadedAt: "desc" },
    });
}
/**
 * Get employment history for an employee.
 */
export async function getEmploymentHistory(employeeId) {
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee)
        throw new AppError(404, "NOT_FOUND", "Employee not found");
    return prisma.employmentHistory.findMany({
        where: { employeeId },
        orderBy: { changedAt: "desc" },
    });
}
/**
 * Assign (upsert) a base role to an employee.
 */
export async function assignRole(employeeId, baseRole, actor) {
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee)
        throw new AppError(404, "NOT_FOUND", "Employee not found");
    const existing = await prisma.userRole.findUnique({ where: { employeeId } });
    const userRole = await prisma.userRole.upsert({
        where: { employeeId },
        update: { baseRole },
        create: { employeeId, baseRole },
    });
    await logActivity({
        actingUserId: actor.userId,
        actingRole: actor.role,
        actionType: "EMPLOYEE_ROLE_ASSIGNED",
        resourceType: "UserRole",
        resourceId: userRole.id,
        previousState: existing ? { baseRole: existing.baseRole } : null,
        newState: { baseRole },
        ipAddress: actor.ipAddress,
    });
    return userRole;
}
/**
 * Assign (upsert) a special privilege to an employee.
 */
export async function assignPrivilege(employeeId, specialPrivilege, actor) {
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee)
        throw new AppError(404, "NOT_FOUND", "Employee not found");
    const existing = await prisma.userRole.findUnique({ where: { employeeId } });
    const userRole = await prisma.userRole.upsert({
        where: { employeeId },
        update: { specialPrivilege },
        create: { employeeId, baseRole: "EMPLOYEE", specialPrivilege },
    });
    await logActivity({
        actingUserId: actor.userId,
        actingRole: actor.role,
        actionType: "EMPLOYEE_PRIVILEGE_ASSIGNED",
        resourceType: "UserRole",
        resourceId: userRole.id,
        previousState: existing ? { specialPrivilege: existing.specialPrivilege } : null,
        newState: { specialPrivilege },
        ipAddress: actor.ipAddress,
    });
    return userRole;
}
/**
 * Get effective permissions for an employee.
 */
export async function getPermissions(employeeId) {
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: { UserRole: true },
    });
    if (!employee)
        throw new AppError(404, "NOT_FOUND", "Employee not found");
    const role = (employee.UserRole?.baseRole ?? "EMPLOYEE");
    const privilege = employee.UserRole?.specialPrivilege;
    const effectiveSet = computeEffectivePermissions(role, privilege);
    return Array.from(effectiveSet);
}
//# sourceMappingURL=employee.service.js.map