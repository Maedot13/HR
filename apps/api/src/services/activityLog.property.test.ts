/**
 * Property 17: Activity Log Completeness (Requirements 16.1, 16.2)
 * Property 18: Activity Log Immutability (Requirements 16.3, 16.6)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import { AppError } from "../middleware/errorHandler.js";

const mockPrisma = vi.hoisted(() => ({
  activityLog: { create: vi.fn(), findMany: vi.fn() },
  employee: { findUnique: vi.fn() },
}));

vi.mock("../lib/prisma.js", () => ({ prisma: mockPrisma }));

import { createLog, queryLogs, updateLog, deleteLog } from "./activityLog.service.js";

const actionTypeArb = fc.constantFrom("LOGIN", "LOGOUT", "EMPLOYEE_CREATED", "EMPLOYEE_UPDATED", "LEAVE_APPROVED", "CLEARANCE_TASK_APPROVED", "ACCOUNT_DEACTIVATED");
const resourceTypeArb = fc.constantFrom("Employee", "LeaveApplication", "ClearanceTask", "PayrollReport");
const roleArb = fc.constantFrom("SUPER_ADMIN", "ADMIN", "HR_OFFICER", "EMPLOYEE");

const logParamsArb = fc.record({
  actingUserId: fc.uuid(),
  actingRole: roleArb,
  actionType: actionTypeArb,
  resourceType: resourceTypeArb,
  resourceId: fc.uuid(),
  ipAddress: fc.ipV4(),
});

describe("Property 17: Activity Log Completeness", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createLog writes an entry with all required fields", async () => {
    await fc.assert(
      fc.asyncProperty(logParamsArb, async (params) => {
        vi.clearAllMocks();
        const expectedLog = { id: "log-1", ...params, previousState: null, newState: null, timestamp: new Date() };
        mockPrisma.activityLog.create.mockResolvedValueOnce(expectedLog);

        const result = await createLog(params);

        expect(mockPrisma.activityLog.create).toHaveBeenCalledOnce();
        const callData = (mockPrisma.activityLog.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
        expect(callData.actingUserId).toBe(params.actingUserId);
        expect(callData.actingRole).toBe(params.actingRole);
        expect(callData.actionType).toBe(params.actionType);
        expect(callData.resourceType).toBe(params.resourceType);
        expect(callData.resourceId).toBe(params.resourceId);
        expect(callData.ipAddress).toBe(params.ipAddress);
        expect(result).toEqual(expectedLog);
      }),
      { numRuns: 100 }
    );
  });

  it("queryLogs with campusId filter joins through actingEmployee.campusId", async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (campusId) => {
        vi.clearAllMocks();
        mockPrisma.activityLog.findMany.mockResolvedValueOnce([]);
        await queryLogs({ campusId });
        const callWhere = (mockPrisma.activityLog.findMany.mock.calls[0][0] as { where: Record<string, unknown> }).where;
        expect(callWhere.actingEmployee).toEqual({ campusId });
      }),
      { numRuns: 100 }
    );
  });
});

describe("Property 18: Activity Log Immutability", () => {
  it("updateLog always throws ACTIVITY_LOG_IMMUTABLE regardless of input", () => {
    fc.assert(
      fc.property(fc.uuid(), fc.record({ actionType: fc.string() }), (id, data) => {
        let err: unknown;
        try { updateLog(id, data); } catch (e) { err = e; }
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).code).toBe("ACTIVITY_LOG_IMMUTABLE");
        expect((err as AppError).statusCode).toBe(403);
      }),
      { numRuns: 100 }
    );
  });

  it("deleteLog always throws ACTIVITY_LOG_IMMUTABLE regardless of input", () => {
    fc.assert(
      fc.property(fc.uuid(), (id) => {
        let err: unknown;
        try { deleteLog(id); } catch (e) { err = e; }
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).code).toBe("ACTIVITY_LOG_IMMUTABLE");
        expect((err as AppError).statusCode).toBe(403);
      }),
      { numRuns: 100 }
    );
  });

  it("updateLog and deleteLog throw for all roles including SUPER_ADMIN", () => {
    fc.assert(
      fc.property(fc.uuid(), fc.constantFrom("SUPER_ADMIN", "ADMIN", "HR_OFFICER", "EMPLOYEE"), (id, _role) => {
        let updateErr: unknown;
        let deleteErr: unknown;
        try { updateLog(id, {}); } catch (e) { updateErr = e; }
        try { deleteLog(id); } catch (e) { deleteErr = e; }
        expect((updateErr as AppError).code).toBe("ACTIVITY_LOG_IMMUTABLE");
        expect((deleteErr as AppError).code).toBe("ACTIVITY_LOG_IMMUTABLE");
      }),
      { numRuns: 100 }
    );
  });

  it("createLog does not throw — write-only operations are permitted", async () => {
    await fc.assert(
      fc.asyncProperty(logParamsArb, async (params) => {
        vi.clearAllMocks();
        mockPrisma.activityLog.create.mockResolvedValueOnce({ id: "log-ok", ...params, timestamp: new Date() });
        await expect(createLog(params)).resolves.toBeDefined();
      }),
      { numRuns: 100 }
    );
  });
});
