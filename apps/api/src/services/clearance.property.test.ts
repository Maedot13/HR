/**
 * Property 16: Clearance Completion Iff All Tasks Approved (Requirements 13.3, 13.5, 13.7)
 * Property 19: Clearance Triggers Account Deactivation (Requirements 15.1, 15.2, 15.3)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import { AppError } from "../middleware/errorHandler.js";

const mockPrisma = vi.hoisted(() => ({
  clearanceBody: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
  clearanceRecord: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  clearanceTask: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  employee: { findUnique: vi.fn(), update: vi.fn() },
  activityLog: { create: vi.fn() },
}));

vi.mock("../lib/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../middleware/activityLogger.js", () => ({ logActivity: vi.fn() }));

import { approveTask, rejectTask } from "./clearance.service.js";

const actor = { userId: "actor-1", role: "HR_OFFICER", campusId: "campus-1", ipAddress: "127.0.0.1" };

function makeBody(id: string, order: number, approvalMode: "SEQUENTIAL" | "PARALLEL" = "PARALLEL") {
  return { id, name: `Body-${id}`, approvalMode, order };
}

function makeTask(id: string, recordId: string, bodyId: string, status: "PENDING" | "ACTIVE" | "APPROVED" | "REJECTED", body: ReturnType<typeof makeBody>) {
  return { id, clearanceRecordId: recordId, clearanceBodyId: bodyId, status, approvedBy: null, approvedAt: null, rejectionReason: null, updatedAt: new Date(), clearanceBody: body };
}

function makeRecord(id: string, employeeId: string, tasks: ReturnType<typeof makeTask>[]) {
  return { id, employeeId, status: "IN_PROGRESS" as const, initiatedAt: new Date(), completedAt: null, tasks };
}

describe("Property 16: Clearance Completion Iff All Tasks Approved", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ClearanceRecord becomes COMPLETED only when every task is APPROVED", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 5 }), async (taskCount) => {
        vi.clearAllMocks();
        const recordId = "rec-1";
        const employeeId = "emp-1";
        const bodies = Array.from({ length: taskCount }, (_, i) => makeBody(`body-${i}`, i, "PARALLEL"));
        const tasks = bodies.map((body, i) => makeTask(`task-${i}`, recordId, body.id, i < taskCount - 1 ? "APPROVED" : "ACTIVE", body));
        const activeTask = tasks[taskCount - 1];
        const record = makeRecord(recordId, employeeId, tasks);

        mockPrisma.clearanceTask.findUnique.mockResolvedValueOnce({ ...activeTask, clearanceRecord: record });
        mockPrisma.clearanceTask.update.mockResolvedValueOnce({ ...activeTask, status: "APPROVED", approvedBy: actor.userId, approvedAt: new Date() });
        mockPrisma.clearanceTask.findMany.mockResolvedValueOnce(tasks.map((t) => ({ ...t, status: "APPROVED" })));
        mockPrisma.clearanceRecord.update.mockResolvedValueOnce({ ...record, status: "COMPLETED" });
        mockPrisma.employee.update.mockResolvedValueOnce({ id: employeeId, status: "INACTIVE" });

        await approveTask(activeTask.id, actor);

        expect(mockPrisma.clearanceRecord.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: recordId }, data: expect.objectContaining({ status: "COMPLETED" }) }));
        expect(mockPrisma.employee.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: employeeId }, data: { status: "INACTIVE" } }));
      }),
      { numRuns: 100 }
    );
  });

  it("ClearanceRecord stays IN_PROGRESS when at least one task is not APPROVED", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 5 }), async (taskCount) => {
        vi.clearAllMocks();
        const recordId = "rec-2";
        const employeeId = "emp-2";
        const bodies = Array.from({ length: taskCount }, (_, i) => makeBody(`body-${i}`, i, "PARALLEL"));
        const tasks = bodies.map((body, i) => makeTask(`task-${i}`, recordId, body.id, i === 0 ? "ACTIVE" : "PENDING", body));
        const activeTask = tasks[0];
        const record = makeRecord(recordId, employeeId, tasks);

        mockPrisma.clearanceTask.findUnique.mockResolvedValueOnce({ ...activeTask, clearanceRecord: record });
        mockPrisma.clearanceTask.update.mockResolvedValueOnce({ ...activeTask, status: "APPROVED" });
        mockPrisma.clearanceTask.findMany.mockResolvedValueOnce(tasks.map((t, i) => ({ ...t, status: i === 0 ? "APPROVED" : "PENDING" })));

        await approveTask(activeTask.id, actor);

        expect(mockPrisma.clearanceRecord.update).not.toHaveBeenCalled();
        expect(mockPrisma.employee.update).not.toHaveBeenCalled();
      }),
      { numRuns: 100 }
    );
  });

  it("Sequential tasks do not become ACTIVE before preceding tasks are APPROVED", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 3, max: 5 }), async (taskCount) => {
        vi.clearAllMocks();
        const recordId = "rec-3";
        const employeeId = "emp-3";
        const bodies = Array.from({ length: taskCount }, (_, i) => makeBody(`body-${i}`, i, "SEQUENTIAL"));
        const tasks = bodies.map((body, i) => makeTask(`task-${i}`, recordId, body.id, i === 0 ? "ACTIVE" : "PENDING", body));
        const activeTask = tasks[0];
        const record = makeRecord(recordId, employeeId, tasks);

        mockPrisma.clearanceTask.findUnique.mockResolvedValueOnce({ ...activeTask, clearanceRecord: record });
        mockPrisma.clearanceTask.update
          .mockResolvedValueOnce({ ...activeTask, status: "APPROVED" })
          .mockResolvedValueOnce({ ...tasks[1], status: "ACTIVE" });
        mockPrisma.clearanceTask.findMany.mockResolvedValueOnce(tasks.map((t, i) => ({ ...t, status: i === 0 ? "APPROVED" : "PENDING" })));

        await approveTask(activeTask.id, actor);

        const updateCalls = mockPrisma.clearanceTask.update.mock.calls;
        const activationCall = updateCalls.find((call) => (call[0] as any).where.id === tasks[1].id && (call[0] as any).data.status === "ACTIVE");
        expect(activationCall).toBeDefined();

        for (let i = 2; i < taskCount; i++) {
          const premature = updateCalls.find((call) => (call[0] as any).where.id === tasks[i].id && (call[0] as any).data.status === "ACTIVE");
          expect(premature).toBeUndefined();
        }
      }),
      { numRuns: 100 }
    );
  });

  it("Rejecting a task does not complete the clearance record", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 100 }), async (reason) => {
        vi.clearAllMocks();
        const body = makeBody("body-0", 0, "PARALLEL");
        const task = makeTask("task-0", "rec-4", body.id, "ACTIVE", body);
        mockPrisma.clearanceTask.findUnique.mockResolvedValueOnce(task);
        mockPrisma.clearanceTask.update.mockResolvedValueOnce({ ...task, status: "REJECTED", rejectionReason: reason });

        await rejectTask(task.id, reason, actor);

        expect(mockPrisma.clearanceRecord.update).not.toHaveBeenCalled();
        expect(mockPrisma.employee.update).not.toHaveBeenCalled();
      }),
      { numRuns: 100 }
    );
  });
});

describe("Property 19: Clearance Triggers Account Deactivation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("Employee.status is set to INACTIVE when ClearanceRecord transitions to COMPLETED", async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (employeeId) => {
        vi.clearAllMocks();
        const recordId = "rec-deact";
        const body = makeBody("body-0", 0, "PARALLEL");
        const task = makeTask("task-0", recordId, body.id, "ACTIVE", body);
        const record = makeRecord(recordId, employeeId, [task]);

        mockPrisma.clearanceTask.findUnique.mockResolvedValueOnce({ ...task, clearanceRecord: record });
        mockPrisma.clearanceTask.update.mockResolvedValueOnce({ ...task, status: "APPROVED", approvedBy: actor.userId, approvedAt: new Date() });
        mockPrisma.clearanceTask.findMany.mockResolvedValueOnce([{ ...task, status: "APPROVED" }]);
        mockPrisma.clearanceRecord.update.mockResolvedValueOnce({ ...record, status: "COMPLETED" });
        mockPrisma.employee.update.mockResolvedValueOnce({ id: employeeId, status: "INACTIVE" });

        await approveTask(task.id, actor);

        expect(mockPrisma.employee.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: employeeId }, data: { status: "INACTIVE" } }));
      }),
      { numRuns: 100 }
    );
  });

  it("approveTask throws INVALID_STATUS for non-ACTIVE tasks", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom("PENDING", "APPROVED", "REJECTED"), async (status) => {
        vi.clearAllMocks();
        const body = makeBody("body-0", 0, "PARALLEL");
        const task = makeTask("task-bad", "rec-1", body.id, status as "PENDING" | "APPROVED" | "REJECTED", body);
        const record = makeRecord("rec-1", "emp-1", [task]);
        mockPrisma.clearanceTask.findUnique.mockResolvedValueOnce({ ...task, clearanceRecord: record });

        let err: unknown;
        try { await approveTask(task.id, actor); } catch (e) { err = e; }

        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).code).toBe("INVALID_STATUS");
      }),
      { numRuns: 100 }
    );
  });
});
