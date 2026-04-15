import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { logActivity } from "../middleware/activityLogger.js";
function computeDuration(start, end) {
    // Guard: Handle null dates
    if (!start || !end)
        return "N/A";
    const totalDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    // Guard: Handle negative or zero duration
    if (totalDays <= 0)
        return "0 days";
    const years = Math.floor(totalDays / 365);
    const months = Math.floor((totalDays % 365) / 30);
    const days = totalDays % 30;
    const parts = [];
    if (years > 0)
        parts.push(`${years} year${years !== 1 ? "s" : ""}`);
    if (months > 0)
        parts.push(`${months} month${months !== 1 ? "s" : ""}`);
    if (days > 0)
        parts.push(`${days} day${days !== 1 ? "s" : ""}`);
    return parts.length > 0 ? parts.join(", ") : "0 days";
}
export async function generateExperienceLetter(employeeId, format, actor) {
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: { EmploymentHistory: { orderBy: { changedAt: "desc" } } },
    });
    // IMPROVED: User-friendly error message
    if (!employee) {
        throw new AppError(404, "NOT_FOUND", "Unable to generate experience letter. Employee record not found.");
    }
    // ADDED: Safe fallback for missing employment history
    const employmentHistory = employee.EmploymentHistory ?? [];
    const mostRecentPosition = employmentHistory.find((h) => h.changeType === "position");
    const positionTitle = mostRecentPosition?.newValue ?? "N/A";
    // ADDED: Safe date handling with fallbacks
    const hireDate = employee.hireDate ?? employee.createdAt;
    const endDate = employee.endDate ?? new Date();
    const duration = computeDuration(hireDate, endDate);
    const fileUrl = `/letters/${employeeId}-${Date.now()}.${format.toLowerCase()}`;
    const letter = await prisma.experienceLetter.create({ data: { employeeId, generatedBy: actor.userId, format, fileUrl } });
    await logActivity({ actingUserId: actor.userId, actingRole: actor.role, actionType: "EXPERIENCE_LETTER_GENERATED", resourceType: "ExperienceLetter", resourceId: letter.id, newState: { employeeId, fullName: employee.fullName, positionTitle, duration, format, fileUrl }, ipAddress: actor.ipAddress });
    return { ...letter, fullName: employee.fullName, positionTitle, hireDate, endDate, duration };
}
export async function listExperienceLetters(employeeId) {
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
        throw new AppError(404, "NOT_FOUND", "Unable to retrieve experience letters. Employee record not found.");
    }
    return prisma.experienceLetter.findMany({ where: { employeeId }, orderBy: { generatedAt: "desc" } });
}
//# sourceMappingURL=document.service.js.map