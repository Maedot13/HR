import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { logActivity } from "../middleware/activityLogger.js";
export async function configureBodies(data, actor) {
    const results = await Promise.all(data.map((body) => prisma.clearanceBody.upsert({
        where: { name: body.name },
        update: { approvalMode: body.approvalMode, order: body.order },
        create: { name: body.name, approvalMode: body.approvalMode, order: body.order },
    })));
    await logActivity({ actingUserId: actor.userId, actingRole: actor.role, actionType: "CLEARANCE_BODIES_CONFIGURED", resourceType: "ClearanceBody", resourceId: "bulk", newState: { bodies: data }, ipAddress: actor.ipAddress });
    return results;
}
export async function listBodies() {
    return prisma.clearanceBody.findMany({ orderBy: { order: "asc" } });
}
export async function updateBody(id, data, actor) {
    const existing = await prisma.clearanceBody.findUnique({ where: { id } });
    if (!existing)
        throw new AppError(404, "NOT_FOUND", "Clearance body not found. It may have been deleted. Please refresh and try again.");
    const updated = await prisma.clearanceBody.update({ where: { id }, data });
    await logActivity({ actingUserId: actor.userId, actingRole: actor.role, actionType: "CLEARANCE_BODY_UPDATED", resourceType: "ClearanceBody", resourceId: id, previousState: existing, newState: updated, ipAddress: actor.ipAddress });
    return updated;
}
export async function initiateClearance(employeeId, actor) {
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee)
        throw new AppError(404, "NOT_FOUND", "Employee record not found. Please verify the Employee ID and try again.");
    const existing = await prisma.clearanceRecord.findUnique({ where: { employeeId } });
    if (existing)
        throw new AppError(409, "CLEARANCE_ALREADY_EXISTS", "A clearance process has already been started for this employee. Please load the existing record to continue.");
    const bodies = await prisma.clearanceBody.findMany({ orderBy: { order: "asc" } });
    if (bodies.length === 0)
        throw new AppError(422, "NO_CLEARANCE_BODIES", "No clearance bodies have been configured yet. Please set up clearance bodies in the Clearance Bodies tab before initiating a clearance process.");
    const seqBodies = bodies.filter((b) => b.approvalMode === "SEQUENTIAL");
    const minSeqOrder = seqBodies.length > 0 ? Math.min(...seqBodies.map((b) => b.order)) : Infinity;
    const record = await prisma.clearanceRecord.create({
        data: {
            employeeId,
            status: "IN_PROGRESS",
            ClearanceTask: {
                create: bodies.map((body) => {
                    let status;
                    if (body.approvalMode === "PARALLEL") {
                        status = "ACTIVE";
                    }
                    else {
                        status = body.order === minSeqOrder ? "ACTIVE" : "PENDING";
                    }
                    return { clearanceBodyId: body.id, status };
                }),
            },
        },
        include: { ClearanceTask: { include: { ClearanceBody: true } } },
    });
    await logActivity({ actingUserId: actor.userId, actingRole: actor.role, actionType: "CLEARANCE_INITIATED", resourceType: "ClearanceRecord", resourceId: record.id, newState: { employeeId, status: "IN_PROGRESS" }, ipAddress: actor.ipAddress });
    return record;
}
export async function approveTask(taskId, actor) {
    const task = await prisma.clearanceTask.findUnique({
        where: { id: taskId },
        include: { ClearanceBody: true, ClearanceRecord: { include: { ClearanceTask: { include: { ClearanceBody: true } } } } },
    });
    if (!task)
        throw new AppError(404, "NOT_FOUND", "Clearance task not found. Please refresh the page and try again.");
    if (task.status !== "ACTIVE")
        throw new AppError(422, "INVALID_STATUS", "This task has already been completed and cannot be approved again. Only active tasks can be approved.");
    const updatedTask = await prisma.clearanceTask.update({
        where: { id: taskId },
        data: { status: "APPROVED", approvedBy: actor.userId, approvedAt: new Date() },
    });
    // If SEQUENTIAL: activate the next PENDING sequential task
    if (task.ClearanceBody.approvalMode === "SEQUENTIAL") {
        const pendingSeq = task.ClearanceRecord.ClearanceTask
            .filter((t) => t.status === "PENDING" && t.ClearanceBody.approvalMode === "SEQUENTIAL")
            .sort((a, b) => a.ClearanceBody.order - b.ClearanceBody.order);
        if (pendingSeq.length > 0) {
            await prisma.clearanceTask.update({ where: { id: pendingSeq[0].id }, data: { status: "ACTIVE" } });
        }
    }
    // Re-fetch all tasks to check if all approved
    const allTasks = await prisma.clearanceTask.findMany({ where: { clearanceRecordId: task.clearanceRecordId } });
    const allApproved = allTasks.every((t) => t.id === taskId || t.status === "APPROVED");
    if (allApproved) {
        await prisma.clearanceRecord.update({ where: { id: task.clearanceRecordId }, data: { status: "COMPLETED", completedAt: new Date() } });
        await prisma.employee.update({ where: { id: task.ClearanceRecord.employeeId }, data: { status: "INACTIVE" } });
        await logActivity({ actingUserId: actor.userId, actingRole: actor.role, actionType: "ACCOUNT_DEACTIVATED", resourceType: "Employee", resourceId: task.ClearanceRecord.employeeId, previousState: { status: "ACTIVE" }, newState: { status: "INACTIVE" }, ipAddress: actor.ipAddress });
    }
    await logActivity({ actingUserId: actor.userId, actingRole: actor.role, actionType: "CLEARANCE_TASK_APPROVED", resourceType: "ClearanceTask", resourceId: taskId, previousState: { status: "ACTIVE" }, newState: { status: "APPROVED" }, ipAddress: actor.ipAddress });
    return updatedTask;
}
export async function rejectTask(taskId, rejectionReason, actor) {
    const task = await prisma.clearanceTask.findUnique({ where: { id: taskId } });
    if (!task)
        throw new AppError(404, "NOT_FOUND", "Clearance task not found. Please refresh the page and try again.");
    if (task.status !== "ACTIVE")
        throw new AppError(422, "INVALID_STATUS", "This task has already been completed and cannot be rejected again. Only active tasks can be rejected.");
    const updated = await prisma.clearanceTask.update({ where: { id: taskId }, data: { status: "REJECTED", rejectionReason } });
    await logActivity({ actingUserId: actor.userId, actingRole: actor.role, actionType: "CLEARANCE_TASK_REJECTED", resourceType: "ClearanceTask", resourceId: taskId, previousState: { status: "ACTIVE" }, newState: { status: "REJECTED", rejectionReason }, ipAddress: actor.ipAddress });
    return updated;
}
export async function getClearanceRecord(employeeId) {
    const record = await prisma.clearanceRecord.findUnique({ where: { employeeId }, include: { ClearanceTask: { include: { ClearanceBody: true } } } });
    if (!record)
        throw new AppError(404, "NOT_FOUND", "No clearance record found for this employee. Use 'Initiate Clearance' to start the process.");
    return record;
}
//# sourceMappingURL=clearance.service.js.map