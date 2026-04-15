import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { logActivity } from "../middleware/activityLogger.js";
// ─── Campus ───────────────────────────────────────────────────────────────────
export async function createCampus(code, name, actor) {
    const campus = await prisma.campus.create({ data: { code, name } });
    await logActivity({
        actingUserId: actor.userId,
        actingRole: actor.role,
        actionType: "CAMPUS_CREATED",
        resourceType: "Campus",
        resourceId: campus.id,
        newState: campus,
        ipAddress: actor.ipAddress,
    });
    return campus;
}
export async function listCampuses() {
    return prisma.campus.findMany({ orderBy: { name: "asc" } });
}
export async function getCampusById(id) {
    const campus = await prisma.campus.findUnique({ where: { id } });
    if (!campus)
        throw new AppError(404, "NOT_FOUND", "Campus not found");
    return campus;
}
export async function updateCampus(id, payload, actor) {
    if ("code" in payload) {
        throw new AppError(400, "CAMPUS_CODE_IMMUTABLE", "Campus code cannot be changed after creation");
    }
    const existing = await prisma.campus.findUnique({ where: { id } });
    if (!existing)
        throw new AppError(404, "NOT_FOUND", "Campus not found");
    const updated = await prisma.campus.update({
        where: { id },
        data: { name: payload.name },
    });
    await logActivity({
        actingUserId: actor.userId,
        actingRole: actor.role,
        actionType: "CAMPUS_UPDATED",
        resourceType: "Campus",
        resourceId: id,
        previousState: existing,
        newState: updated,
        ipAddress: actor.ipAddress,
    });
    return updated;
}
export async function deleteCampus(id, actor) {
    const campus = await prisma.campus.findUnique({ where: { id } });
    if (!campus)
        throw new AppError(404, "NOT_FOUND", "Campus not found");
    const employeeCount = await prisma.employee.count({ where: { campusId: id } });
    if (employeeCount > 0) {
        throw new AppError(409, "CAMPUS_HAS_EMPLOYEES", "Cannot delete a campus that has linked employees");
    }
    await prisma.campus.delete({ where: { id } });
    await logActivity({
        actingUserId: actor.userId,
        actingRole: actor.role,
        actionType: "CAMPUS_DELETED",
        resourceType: "Campus",
        resourceId: id,
        previousState: campus,
        ipAddress: actor.ipAddress,
    });
}
// ─── College ──────────────────────────────────────────────────────────────────
export async function createCollege(name, campusId, actor) {
    const campus = await prisma.campus.findUnique({ where: { id: campusId } });
    if (!campus)
        throw new AppError(404, "NOT_FOUND", "Campus not found");
    const college = await prisma.college.create({ data: { name, campusId } });
    await logActivity({
        actingUserId: actor.userId,
        actingRole: actor.role,
        actionType: "COLLEGE_CREATED",
        resourceType: "College",
        resourceId: college.id,
        newState: college,
        ipAddress: actor.ipAddress,
    });
    return college;
}
export async function listColleges(campusId) {
    return prisma.college.findMany({
        where: campusId ? { campusId } : undefined,
        orderBy: { name: "asc" },
    });
}
export async function getCollegeById(id) {
    const college = await prisma.college.findUnique({ where: { id } });
    if (!college)
        throw new AppError(404, "NOT_FOUND", "College not found");
    return college;
}
export async function updateCollege(id, name, actor) {
    const existing = await prisma.college.findUnique({ where: { id } });
    if (!existing)
        throw new AppError(404, "NOT_FOUND", "College not found");
    const updated = await prisma.college.update({ where: { id }, data: { name } });
    await logActivity({
        actingUserId: actor.userId,
        actingRole: actor.role,
        actionType: "COLLEGE_UPDATED",
        resourceType: "College",
        resourceId: id,
        previousState: existing,
        newState: updated,
        ipAddress: actor.ipAddress,
    });
    return updated;
}
export async function deleteCollege(id, actor) {
    const existing = await prisma.college.findUnique({ where: { id } });
    if (!existing)
        throw new AppError(404, "NOT_FOUND", "College not found");
    await prisma.college.delete({ where: { id } });
    await logActivity({
        actingUserId: actor.userId,
        actingRole: actor.role,
        actionType: "COLLEGE_DELETED",
        resourceType: "College",
        resourceId: id,
        previousState: existing,
        ipAddress: actor.ipAddress,
    });
}
// ─── Department ───────────────────────────────────────────────────────────────
export async function createDepartment(name, collegeId, actor) {
    const college = await prisma.college.findUnique({ where: { id: collegeId } });
    if (!college)
        throw new AppError(404, "NOT_FOUND", "College not found");
    const department = await prisma.department.create({ data: { name, collegeId } });
    await logActivity({
        actingUserId: actor.userId,
        actingRole: actor.role,
        actionType: "DEPARTMENT_CREATED",
        resourceType: "Department",
        resourceId: department.id,
        newState: department,
        ipAddress: actor.ipAddress,
    });
    return department;
}
export async function listDepartments(collegeId) {
    return prisma.department.findMany({
        where: collegeId ? { collegeId } : undefined,
        orderBy: { name: "asc" },
    });
}
export async function getDepartmentById(id) {
    const department = await prisma.department.findUnique({ where: { id } });
    if (!department)
        throw new AppError(404, "NOT_FOUND", "Department not found");
    return department;
}
export async function updateDepartment(id, name, actor) {
    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing)
        throw new AppError(404, "NOT_FOUND", "Department not found");
    const updated = await prisma.department.update({ where: { id }, data: { name } });
    await logActivity({
        actingUserId: actor.userId,
        actingRole: actor.role,
        actionType: "DEPARTMENT_UPDATED",
        resourceType: "Department",
        resourceId: id,
        previousState: existing,
        newState: updated,
        ipAddress: actor.ipAddress,
    });
    return updated;
}
export async function deleteDepartment(id, actor) {
    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing)
        throw new AppError(404, "NOT_FOUND", "Department not found");
    await prisma.department.delete({ where: { id } });
    await logActivity({
        actingUserId: actor.userId,
        actingRole: actor.role,
        actionType: "DEPARTMENT_DELETED",
        resourceType: "Department",
        resourceId: id,
        previousState: existing,
        ipAddress: actor.ipAddress,
    });
}
// ─── Unit ─────────────────────────────────────────────────────────────────────
export async function createUnit(name, departmentId, actor) {
    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!department)
        throw new AppError(404, "NOT_FOUND", "Department not found");
    // Cross-campus validation for Admin role
    if (actor.role === "ADMIN") {
        const college = await prisma.college.findUnique({ where: { id: department.collegeId } });
        if (!college || college.campusId !== actor.campusId) {
            throw new AppError(403, "CROSS_CAMPUS_VIOLATION", "Admin can only manage units within their own campus");
        }
    }
    const unit = await prisma.unit.create({ data: { name, departmentId } });
    await logActivity({
        actingUserId: actor.userId,
        actingRole: actor.role,
        actionType: "UNIT_CREATED",
        resourceType: "Unit",
        resourceId: unit.id,
        newState: unit,
        ipAddress: actor.ipAddress,
    });
    return unit;
}
export async function listUnits(departmentId) {
    return prisma.unit.findMany({
        where: departmentId ? { departmentId } : undefined,
        orderBy: { name: "asc" },
    });
}
export async function getUnitById(id) {
    const unit = await prisma.unit.findUnique({ where: { id } });
    if (!unit)
        throw new AppError(404, "NOT_FOUND", "Unit not found");
    return unit;
}
export async function updateUnit(id, name, actor) {
    const existing = await prisma.unit.findUnique({ where: { id } });
    if (!existing)
        throw new AppError(404, "NOT_FOUND", "Unit not found");
    const updated = await prisma.unit.update({ where: { id }, data: { name } });
    await logActivity({
        actingUserId: actor.userId,
        actingRole: actor.role,
        actionType: "UNIT_UPDATED",
        resourceType: "Unit",
        resourceId: id,
        previousState: existing,
        newState: updated,
        ipAddress: actor.ipAddress,
    });
    return updated;
}
export async function deleteUnit(id, actor) {
    const existing = await prisma.unit.findUnique({ where: { id } });
    if (!existing)
        throw new AppError(404, "NOT_FOUND", "Unit not found");
    await prisma.unit.delete({ where: { id } });
    await logActivity({
        actingUserId: actor.userId,
        actingRole: actor.role,
        actionType: "UNIT_DELETED",
        resourceType: "Unit",
        resourceId: id,
        previousState: existing,
        ipAddress: actor.ipAddress,
    });
}
/**
 * Validate that a unit belongs to the Admin's campus.
 * Used when linking an employee to a unit.
 */
export async function validateUnitBelongsToCampus(unitId, campusId) {
    const unit = await prisma.unit.findUnique({
        where: { id: unitId },
        include: { Department: { include: { College: true } } },
    });
    if (!unit)
        throw new AppError(404, "NOT_FOUND", "Unit not found");
    if (unit.Department.College.campusId !== campusId) {
        throw new AppError(403, "CROSS_CAMPUS_VIOLATION", "The unit does not belong to the Admin's campus");
    }
}
//# sourceMappingURL=org.service.js.map