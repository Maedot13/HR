/**
 * Integration Test: Full Clearance Pipeline
 * Validates: Requirements 13.1–13.7, 15.1–15.3
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
const mockPrisma = vi.hoisted(() => ({
    clearanceBody: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    clearanceRecord: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    clearanceTask: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    employee: { findUnique: vi.fn(), update: vi.fn() },
    activityLog: { create: vi.fn() },
}));
vi.mock("../lib/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../middleware/activityLogger.js", () => ({ logActivity: vi.fn() }));
import { initiateClearance, approveTask } from "../services/clearance.service.js";
const actor = { userId: "actor-1", role: "HR_OFFICER", campusId: "campus-1", ipAddress: "127.0.0.1" };
const EMPLOYEE_ID = "emp-1";
const RECORD_ID = "rec-1";
function makeBody(id, order, mode) {
    return { id, name: `Body-${id}`, approvalMode: mode, order };
}
function makeTask(id, body, status) {
    return { id, clearanceRecordId: RECORD_ID, clearanceBodyId: body.id, status, approvedBy: null, approvedAt: null, rejectionReason: null, updatedAt: new Date(), clearanceBody: body };
}
function makeRecord(tasks) {
    return { id: RECORD_ID, employeeId: EMPLOYEE_ID, status: "IN_PROGRESS", initiatedAt: new Date(), completedAt: null, tasks };
}
describe("Integration: Full Clearance Pipeline", () => {
    beforeEach(() => vi.clearAllMocks());
    it("initiates clearance and creates tasks for all configured bodies", async () => {
        const seqBody = makeBody("body-seq", 1, "SEQUENTIAL");
        const parBody = makeBody("body-par", 2, "PARALLEL");
        mockPrisma.employee.findUnique.mockResolvedValueOnce({ id: EMPLOYEE_ID, status: "ACTIVE" });
        mockPrisma.clearanceRecord.findUnique.mockResolvedValueOnce(null);
        mockPrisma.clearanceBody.findMany.mockResolvedValueOnce([seqBody, parBody]);
        mockPrisma.clearanceRecord.create.mockResolvedValueOnce(makeRecord([makeTask("t-seq", seqBody, "ACTIVE"), makeTask("t-par", parBody, "ACTIVE")]));
        const record = await initiateClearance(EMPLOYEE_ID, actor);
        expect(record.status).toBe("IN_PROGRESS");
        expect(record.tasks).toHaveLength(2);
    });
    it("approves sequential task and activates next pending sequential task", async () => {
        const b1 = makeBody("b1", 1, "SEQUENTIAL");
        const b2 = makeBody("b2", 2, "SEQUENTIAL");
        const t1 = makeTask("t1", b1, "ACTIVE");
        const t2 = makeTask("t2", b2, "PENDING");
        mockPrisma.clearanceTask.findUnique.mockResolvedValueOnce({ ...t1, clearanceRecord: makeRecord([t1, t2]) });
        mockPrisma.clearanceTask.update.mockResolvedValueOnce({ ...t1, status: "APPROVED" }).mockResolvedValueOnce({ ...t2, status: "ACTIVE" });
        mockPrisma.clearanceTask.findMany.mockResolvedValueOnce([{ ...t1, status: "APPROVED" }, { ...t2, status: "PENDING" }]);
        await approveTask("t1", actor);
        const activationCall = mockPrisma.clearanceTask.update.mock.calls.find((c) => c[0].where.id === "t2" && c[0].data.status === "ACTIVE");
        expect(activationCall).toBeDefined();
        expect(mockPrisma.clearanceRecord.update).not.toHaveBeenCalled();
    });
    it("completes clearance and sets employee INACTIVE when all tasks approved", async () => {
        const body = makeBody("b-last", 1, "PARALLEL");
        const task = makeTask("t-last", body, "ACTIVE");
        mockPrisma.clearanceTask.findUnique.mockResolvedValueOnce({ ...task, clearanceRecord: makeRecord([task]) });
        mockPrisma.clearanceTask.update.mockResolvedValueOnce({ ...task, status: "APPROVED", approvedBy: actor.userId, approvedAt: new Date() });
        mockPrisma.clearanceTask.findMany.mockResolvedValueOnce([{ ...task, status: "APPROVED" }]);
        mockPrisma.clearanceRecord.update.mockResolvedValueOnce({ ...makeRecord([task]), status: "COMPLETED" });
        mockPrisma.employee.update.mockResolvedValueOnce({ id: EMPLOYEE_ID, status: "INACTIVE" });
        await approveTask("t-last", actor);
        expect(mockPrisma.clearanceRecord.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED" }) }));
        expect(mockPrisma.employee.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: EMPLOYEE_ID }, data: { status: "INACTIVE" } }));
    });
    it("full pipeline: initiate → approve seq → approve par → COMPLETED + INACTIVE", async () => {
        const seqBody = makeBody("b-seq", 1, "SEQUENTIAL");
        const parBody = makeBody("b-par", 2, "PARALLEL");
        mockPrisma.employee.findUnique.mockResolvedValueOnce({ id: EMPLOYEE_ID, status: "ACTIVE" });
        mockPrisma.clearanceRecord.findUnique.mockResolvedValueOnce(null);
        mockPrisma.clearanceBody.findMany.mockResolvedValueOnce([seqBody, parBody]);
        const seqTask = makeTask("t-seq", seqBody, "ACTIVE");
        const parTask = makeTask("t-par", parBody, "ACTIVE");
        mockPrisma.clearanceRecord.create.mockResolvedValueOnce(makeRecord([seqTask, parTask]));
        const record = await initiateClearance(EMPLOYEE_ID, actor);
        expect(record.tasks).toHaveLength(2);
        mockPrisma.clearanceTask.findUnique.mockResolvedValueOnce({ ...seqTask, clearanceRecord: makeRecord([seqTask, parTask]) });
        mockPrisma.clearanceTask.update.mockResolvedValueOnce({ ...seqTask, status: "APPROVED" });
        mockPrisma.clearanceTask.findMany.mockResolvedValueOnce([{ ...seqTask, status: "APPROVED" }, { ...parTask, status: "ACTIVE" }]);
        await approveTask("t-seq", actor);
        expect(mockPrisma.clearanceRecord.update).not.toHaveBeenCalled();
        mockPrisma.clearanceTask.findUnique.mockResolvedValueOnce({ ...parTask, clearanceRecord: makeRecord([{ ...seqTask, status: "APPROVED" }, parTask]) });
        mockPrisma.clearanceTask.update.mockResolvedValueOnce({ ...parTask, status: "APPROVED" });
        mockPrisma.clearanceTask.findMany.mockResolvedValueOnce([{ ...seqTask, status: "APPROVED" }, { ...parTask, status: "APPROVED" }]);
        mockPrisma.clearanceRecord.update.mockResolvedValueOnce({ ...record, status: "COMPLETED" });
        mockPrisma.employee.update.mockResolvedValueOnce({ id: EMPLOYEE_ID, status: "INACTIVE" });
        await approveTask("t-par", actor);
        expect(mockPrisma.clearanceRecord.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED" }) }));
        expect(mockPrisma.employee.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: EMPLOYEE_ID }, data: { status: "INACTIVE" } }));
    });
});
//# sourceMappingURL=clearance.integration.test.js.map