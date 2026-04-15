import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { logActivity } from "../middleware/activityLogger.js";
export async function createEntry(data, actor) {
    // Check for instructor schedule overlap on the same day
    const overlapping = await prisma.scheduleEntry.findFirst({
        where: {
            employeeId: data.employeeId,
            dayOfWeek: data.dayOfWeek,
            startTime: { lt: data.endTime },
            endTime: { gt: data.startTime },
        },
    });
    if (overlapping) {
        throw new AppError(409, "SCHEDULE_CONFLICT", "This time slot overlaps with an existing schedule entry. Please choose a different time or day.", {
            conflictingEntry: {
                id: overlapping.id,
                course: overlapping.course,
                startTime: overlapping.startTime,
                endTime: overlapping.endTime,
            },
        });
    }
    const entry = await prisma.scheduleEntry.create({ data });
    await logActivity({
        actingUserId: actor.userId,
        actingRole: actor.role,
        actionType: "SCHEDULE_ENTRY_CREATED",
        resourceType: "ScheduleEntry",
        resourceId: entry.id,
        newState: entry,
        ipAddress: actor.ipAddress,
    });
    return entry;
}
export async function updateEntry(id, data, actor) {
    const existing = await prisma.scheduleEntry.findUnique({ where: { id } });
    if (!existing)
        throw new AppError(404, "NOT_FOUND", "Schedule entry not found. It may have been deleted. Please refresh and try again.");
    const updated = await prisma.scheduleEntry.update({ where: { id }, data });
    await logActivity({
        actingUserId: actor.userId,
        actingRole: actor.role,
        actionType: "SCHEDULE_ENTRY_UPDATED",
        resourceType: "ScheduleEntry",
        resourceId: id,
        previousState: existing,
        newState: updated,
        ipAddress: actor.ipAddress,
    });
    return updated;
}
export async function deleteEntry(id, actor) {
    const existing = await prisma.scheduleEntry.findUnique({ where: { id } });
    if (!existing)
        throw new AppError(404, "NOT_FOUND", "Schedule entry not found. It may have been deleted. Please refresh and try again.");
    await prisma.scheduleEntry.delete({ where: { id } });
    await logActivity({
        actingUserId: actor.userId,
        actingRole: actor.role,
        actionType: "SCHEDULE_ENTRY_DELETED",
        resourceType: "ScheduleEntry",
        resourceId: id,
        previousState: existing,
        ipAddress: actor.ipAddress,
    });
}
export async function recordSubstitution(scheduleEntryId, data, actor) {
    const entry = await prisma.scheduleEntry.findUnique({
        where: { id: scheduleEntryId },
    });
    if (!entry)
        throw new AppError(404, "NOT_FOUND", "Schedule entry not found");
    const substitution = await prisma.substitution.create({
        data: {
            scheduleEntryId,
            substituteId: data.substituteId,
            sessionDate: new Date(data.sessionDate),
            loggedBy: actor.userId,
        },
    });
    await logActivity({
        actingUserId: actor.userId,
        actingRole: actor.role,
        actionType: "SUBSTITUTION_RECORDED",
        resourceType: "Substitution",
        resourceId: substitution.id,
        newState: substitution,
        ipAddress: actor.ipAddress,
    });
    return substitution;
}
export async function getEmployeeTimetable(employeeId) {
    return prisma.scheduleEntry.findMany({
        where: { employeeId },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
}
//# sourceMappingURL=timetable.service.js.map