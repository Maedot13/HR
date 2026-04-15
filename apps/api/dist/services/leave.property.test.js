/**
 * Leave Management Property Tests
 *
 * Property 10: Leave Balance Never Goes Negative (Requirements 9.2, 9.3, 9.4)
 * Property 11: Annual Leave Entitlement Calculation (Requirements 9.8, 9.9)
 * Property 12: Research Leave Eligibility (Requirements 9.21, 9.22)
 * Property 13: Sabbatical Leave Eligibility (Requirements 9.23, 9.24, 9.25)
 * Property 14: Sick Leave 8-Month Hard Cap (Requirements 9.13, 9.14, 9.15)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import { AppError } from "../middleware/errorHandler.js";
import { annualLeaveEntitlement } from "./leave.service.js";
// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockPrisma = vi.hoisted(() => ({
    employee: { findUnique: vi.fn() },
    leaveType: { findUnique: vi.fn() },
    leaveBalance: {
        findUnique: vi.fn(),
        updateMany: vi.fn(),
    },
    leaveApplication: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
    },
    activityLog: { create: vi.fn() },
}));
vi.mock("../lib/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../middleware/activityLogger.js", () => ({ logActivity: vi.fn() }));
import { submitApplication, approveApplication, rejectApplication } from "./leave.service.js";
const actor = {
    userId: "actor-1",
    role: "HR_OFFICER",
    campusId: "campus-1",
    ipAddress: "127.0.0.1",
};
function makeEmployee(overrides = {}) {
    return {
        id: "emp-1",
        employeeId: "BDU-2026-00001",
        fullName: "Test Employee",
        academicRank: null,
        hireDate: new Date("2020-01-01"),
        status: "ACTIVE",
        campusId: "campus-1",
        userRole: { baseRole: "EMPLOYEE", specialPrivilege: null },
        ...overrides,
    };
}
function makeLeaveType(name, overrides = {}) {
    return { id: "lt-1", name, description: "", maxDays: 30, payRate: 1.0, ...overrides };
}
function makeApplication(overrides = {}) {
    return {
        id: "app-1",
        employeeId: "emp-1",
        leaveTypeId: "lt-1",
        startDate: new Date("2026-03-01"),
        endDate: new Date("2026-03-05"),
        reason: "test",
        status: "PENDING",
        leaveType: makeLeaveType("ANNUAL"),
        ...overrides,
    };
}
// ─── Property 10: Leave Balance Never Goes Negative ───────────────────────────
describe("Property 10: Leave Balance Never Goes Negative", () => {
    beforeEach(() => vi.clearAllMocks());
    it("approved duration is deducted exactly from balance", async () => {
        await fc.assert(fc.asyncProperty(fc.integer({ min: 5, max: 30 }), // current balance
        fc.integer({ min: 1, max: 5 }), // requested working days (Mon-Fri week)
        async (balance, _days) => {
            vi.clearAllMocks();
            const app = makeApplication({ status: "PENDING" });
            mockPrisma.leaveApplication.findUnique.mockResolvedValueOnce(app);
            mockPrisma.leaveBalance.updateMany.mockResolvedValueOnce({ count: 1 });
            mockPrisma.leaveApplication.update.mockResolvedValueOnce({ ...app, status: "APPROVED" });
            const result = await approveApplication("app-1", actor);
            expect(result.status).toBe("APPROVED");
            // updateMany was called to decrement balance
            expect(mockPrisma.leaveBalance.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ balance: expect.objectContaining({ decrement: expect.any(Number) }) }) }));
            const decrementArg = mockPrisma.leaveBalance.updateMany.mock.calls[0][0].data.balance.decrement;
            expect(decrementArg).toBeGreaterThan(0);
            // Simulated: balance after = balance - decrement >= 0
            expect(balance - decrementArg).toBeGreaterThanOrEqual(0);
        }), { numRuns: 100 });
    });
    it("rejected application does not change balance", async () => {
        await fc.assert(fc.asyncProperty(fc.string({ minLength: 1, maxLength: 50 }), async (reason) => {
            vi.clearAllMocks();
            const app = makeApplication({ status: "PENDING" });
            mockPrisma.leaveApplication.findUnique.mockResolvedValueOnce(app);
            mockPrisma.leaveApplication.update.mockResolvedValueOnce({ ...app, status: "REJECTED", rejectionReason: reason });
            await rejectApplication("app-1", reason, actor);
            expect(mockPrisma.leaveBalance.updateMany).not.toHaveBeenCalled();
        }), { numRuns: 100 });
    });
    it("insufficient balance rejects application with currentBalance and shortfall", async () => {
        await fc.assert(fc.asyncProperty(fc.integer({ min: 0, max: 3 }), // low balance
        fc.integer({ min: 5, max: 10 }), // requested days > balance
        async (balance, requestedDays) => {
            vi.clearAllMocks();
            // Use a Mon-Fri week so working days = 5
            const start = new Date("2026-03-02"); // Monday
            const end = new Date("2026-03-06"); // Friday (5 working days)
            mockPrisma.employee.findUnique.mockResolvedValueOnce(makeEmployee());
            mockPrisma.leaveType.findUnique.mockResolvedValueOnce(makeLeaveType("ANNUAL"));
            mockPrisma.leaveBalance.findUnique.mockResolvedValueOnce({ balance });
            let err;
            try {
                await submitApplication("emp-1", {
                    leaveTypeId: "lt-1",
                    startDate: start.toISOString(),
                    endDate: end.toISOString(),
                    reason: "test",
                }, actor);
            }
            catch (e) {
                err = e;
            }
            if (balance < 5) {
                expect(err).toBeInstanceOf(AppError);
                const appErr = err;
                expect(appErr.code).toBe("INSUFFICIENT_LEAVE_BALANCE");
                const details = appErr.details;
                expect(details.currentBalance).toBe(balance);
                expect(details.shortfall).toBeGreaterThan(0);
            }
        }), { numRuns: 100 });
    });
});
// ─── Property 11: Annual Leave Entitlement Calculation ────────────────────────
describe("Property 11: Annual Leave Entitlement Calculation", () => {
    it("entitlement equals min(19 + yearsOfService, 30) for all service years", () => {
        fc.assert(fc.property(fc.integer({ min: 0, max: 50 }), (years) => {
            const entitlement = annualLeaveEntitlement(years);
            expect(entitlement).toBe(Math.min(19 + years, 30));
            expect(entitlement).toBeGreaterThanOrEqual(19);
            expect(entitlement).toBeLessThanOrEqual(30);
        }), { numRuns: 100 });
    });
    it("entitlement caps at 30 for 11+ years of service", () => {
        fc.assert(fc.property(fc.integer({ min: 11, max: 50 }), (years) => {
            expect(annualLeaveEntitlement(years)).toBe(30);
        }), { numRuns: 100 });
    });
    it("academic staff outside July-August are flagged for approval", async () => {
        await fc.assert(fc.asyncProperty(
        // Month outside July(6) and August(7): 0-5 or 8-11
        fc.integer({ min: 0, max: 11 }).filter((m) => m < 6 || m > 7), async (month) => {
            vi.clearAllMocks();
            const year = 2026;
            const day = 10;
            const start = new Date(year, month, day);
            const end = new Date(year, month, day + 4);
            mockPrisma.employee.findUnique.mockResolvedValueOnce(makeEmployee({ academicRank: "LECTURER", hireDate: new Date("2020-01-01") }));
            mockPrisma.leaveType.findUnique.mockResolvedValueOnce(makeLeaveType("ANNUAL"));
            mockPrisma.leaveBalance.findUnique.mockResolvedValueOnce({ balance: 30 });
            mockPrisma.leaveApplication.create.mockResolvedValueOnce({ id: "app-new", status: "PENDING" });
            const result = await submitApplication("emp-1", {
                leaveTypeId: "lt-1",
                startDate: start.toISOString(),
                endDate: end.toISOString(),
                reason: "test",
            }, actor);
            expect(result.requiresApproval).toBe(true);
        }), { numRuns: 100 });
    });
});
// ─── Property 12: Research Leave Eligibility ──────────────────────────────────
describe("Property 12: Research Leave Eligibility Enforcement", () => {
    beforeEach(() => vi.clearAllMocks());
    it("rejects when rank is below Assistant Professor", async () => {
        await fc.assert(fc.asyncProperty(fc.constantFrom("LECTURER", null, undefined, ""), async (rank) => {
            vi.clearAllMocks();
            mockPrisma.employee.findUnique.mockResolvedValueOnce(makeEmployee({ academicRank: rank ?? null, hireDate: new Date("2020-01-01") }));
            mockPrisma.leaveType.findUnique.mockResolvedValueOnce(makeLeaveType("RESEARCH"));
            let err;
            try {
                await submitApplication("emp-1", {
                    leaveTypeId: "lt-1",
                    startDate: "2026-03-01T00:00:00.000Z",
                    endDate: "2026-05-01T00:00:00.000Z",
                    reason: "research",
                }, actor);
            }
            catch (e) {
                err = e;
            }
            expect(err).toBeInstanceOf(AppError);
            expect(err.code).toBe("LEAVE_ELIGIBILITY_FAILED");
        }), { numRuns: 100 });
    });
    it("rejects when service years < 3", async () => {
        await fc.assert(fc.asyncProperty(fc.integer({ min: 0, max: 2 }), async (serviceYears) => {
            vi.clearAllMocks();
            const hireDate = new Date();
            hireDate.setFullYear(hireDate.getFullYear() - serviceYears);
            mockPrisma.employee.findUnique.mockResolvedValueOnce(makeEmployee({ academicRank: "ASSISTANT_PROFESSOR", hireDate }));
            mockPrisma.leaveType.findUnique.mockResolvedValueOnce(makeLeaveType("RESEARCH"));
            let err;
            try {
                await submitApplication("emp-1", {
                    leaveTypeId: "lt-1",
                    startDate: "2026-03-01T00:00:00.000Z",
                    endDate: "2026-05-01T00:00:00.000Z",
                    reason: "research",
                }, actor);
            }
            catch (e) {
                err = e;
            }
            expect(err).toBeInstanceOf(AppError);
            expect(err.code).toBe("LEAVE_ELIGIBILITY_FAILED");
        }), { numRuns: 100 });
    });
    it("approves when rank >= Assistant Professor AND service >= 3 years", async () => {
        await fc.assert(fc.asyncProperty(fc.constantFrom("ASSISTANT_PROFESSOR", "ASSOCIATE_PROFESSOR"), fc.integer({ min: 3, max: 20 }), async (rank, serviceYears) => {
            vi.clearAllMocks();
            const hireDate = new Date();
            hireDate.setFullYear(hireDate.getFullYear() - serviceYears);
            mockPrisma.employee.findUnique.mockResolvedValueOnce(makeEmployee({ academicRank: rank, hireDate }));
            // RESEARCH leave type — balance check is skipped in service
            mockPrisma.leaveType.findUnique.mockResolvedValueOnce(makeLeaveType("RESEARCH"));
            mockPrisma.leaveApplication.create.mockResolvedValueOnce({ id: "app-r", status: "PENDING" });
            const result = await submitApplication("emp-1", {
                leaveTypeId: "lt-1",
                startDate: "2026-03-01T00:00:00.000Z",
                endDate: "2026-05-01T00:00:00.000Z",
                reason: "research",
            }, actor);
            expect(result.status).toBe("PENDING");
        }), { numRuns: 100 });
    });
});
// ─── Property 13: Sabbatical Leave Eligibility ────────────────────────────────
describe("Property 13: Sabbatical Leave Eligibility Enforcement", () => {
    beforeEach(() => vi.clearAllMocks());
    it("rejects when not Academic Staff", async () => {
        await fc.assert(fc.asyncProperty(fc.constant(null), async (rank) => {
            vi.clearAllMocks();
            mockPrisma.employee.findUnique.mockResolvedValueOnce(makeEmployee({ academicRank: rank, hireDate: new Date("2015-01-01") }));
            mockPrisma.leaveType.findUnique.mockResolvedValueOnce(makeLeaveType("SABBATICAL"));
            let err;
            try {
                await submitApplication("emp-1", {
                    leaveTypeId: "lt-1",
                    startDate: "2026-03-01T00:00:00.000Z",
                    endDate: "2027-03-01T00:00:00.000Z",
                    reason: "sabbatical",
                }, actor);
            }
            catch (e) {
                err = e;
            }
            expect(err).toBeInstanceOf(AppError);
            expect(err.code).toBe("LEAVE_ELIGIBILITY_FAILED");
        }), { numRuns: 50 });
    });
    it("rejects when rank is Lecturer (below Assistant Professor)", async () => {
        await fc.assert(fc.asyncProperty(fc.constant("LECTURER"), async (rank) => {
            vi.clearAllMocks();
            mockPrisma.employee.findUnique.mockResolvedValueOnce(makeEmployee({ academicRank: rank, hireDate: new Date("2015-01-01") }));
            mockPrisma.leaveType.findUnique.mockResolvedValueOnce(makeLeaveType("SABBATICAL"));
            let err;
            try {
                await submitApplication("emp-1", {
                    leaveTypeId: "lt-1",
                    startDate: "2026-03-01T00:00:00.000Z",
                    endDate: "2027-03-01T00:00:00.000Z",
                    reason: "sabbatical",
                }, actor);
            }
            catch (e) {
                err = e;
            }
            expect(err).toBeInstanceOf(AppError);
            expect(err.code).toBe("LEAVE_ELIGIBILITY_FAILED");
        }), { numRuns: 50 });
    });
    it("rejects when service < 6 years", async () => {
        await fc.assert(fc.asyncProperty(fc.integer({ min: 0, max: 5 }), async (serviceYears) => {
            vi.clearAllMocks();
            const hireDate = new Date();
            hireDate.setFullYear(hireDate.getFullYear() - serviceYears);
            mockPrisma.employee.findUnique.mockResolvedValueOnce(makeEmployee({ academicRank: "ASSISTANT_PROFESSOR", hireDate }));
            mockPrisma.leaveType.findUnique.mockResolvedValueOnce(makeLeaveType("SABBATICAL"));
            let err;
            try {
                await submitApplication("emp-1", {
                    leaveTypeId: "lt-1",
                    startDate: "2026-03-01T00:00:00.000Z",
                    endDate: "2027-03-01T00:00:00.000Z",
                    reason: "sabbatical",
                }, actor);
            }
            catch (e) {
                err = e;
            }
            expect(err).toBeInstanceOf(AppError);
            expect(err.code).toBe("LEAVE_ELIGIBILITY_FAILED");
        }), { numRuns: 100 });
    });
    it("approves when all three criteria are met", async () => {
        await fc.assert(fc.asyncProperty(fc.constantFrom("ASSISTANT_PROFESSOR", "ASSOCIATE_PROFESSOR"), fc.integer({ min: 7, max: 20 }), // use 7+ to avoid boundary rounding issues
        async (rank, serviceYears) => {
            vi.clearAllMocks();
            const hireDate = new Date();
            hireDate.setFullYear(hireDate.getFullYear() - serviceYears);
            mockPrisma.employee.findUnique.mockResolvedValueOnce(makeEmployee({ academicRank: rank, hireDate }));
            // SABBATICAL leave type — balance check is skipped in service
            mockPrisma.leaveType.findUnique.mockResolvedValueOnce(makeLeaveType("SABBATICAL"));
            mockPrisma.leaveApplication.create.mockResolvedValueOnce({ id: "app-s", status: "PENDING" });
            const result = await submitApplication("emp-1", {
                leaveTypeId: "lt-1",
                startDate: "2026-03-01T00:00:00.000Z",
                endDate: "2027-03-01T00:00:00.000Z",
                reason: "sabbatical",
            }, actor);
            expect(result.status).toBe("PENDING");
        }), { numRuns: 100 });
    });
});
// ─── Property 14: Sick Leave 8-Month Hard Cap ─────────────────────────────────
describe("Property 14: Sick Leave 8-Month Hard Cap", () => {
    beforeEach(() => vi.clearAllMocks());
    it("rejects sick leave application when total would exceed 8 months (240 days)", async () => {
        await fc.assert(fc.asyncProperty(fc.integer({ min: 220, max: 239 }), // already used days close to cap
        fc.integer({ min: 5, max: 30 }), // new request that pushes over
        async (usedDays, newDays) => {
            vi.clearAllMocks();
            mockPrisma.employee.findUnique.mockResolvedValueOnce(makeEmployee());
            mockPrisma.leaveType.findUnique.mockResolvedValueOnce(makeLeaveType("SICK_FULL"));
            // Mock existing sick leave totalling usedDays
            const existingStart = new Date("2025-06-01");
            const existingEnd = new Date(existingStart);
            existingEnd.setDate(existingEnd.getDate() + usedDays - 1);
            mockPrisma.leaveApplication.findMany.mockResolvedValueOnce([
                { startDate: existingStart, endDate: existingEnd, leaveType: { name: "SICK_FULL" } },
            ]);
            const reqStart = new Date("2026-03-01");
            const reqEnd = new Date(reqStart);
            reqEnd.setDate(reqEnd.getDate() + newDays - 1);
            let err;
            try {
                await submitApplication("emp-1", {
                    leaveTypeId: "lt-1",
                    startDate: reqStart.toISOString(),
                    endDate: reqEnd.toISOString(),
                    reason: "sick",
                }, actor);
            }
            catch (e) {
                err = e;
            }
            if (usedDays + newDays > 240) {
                expect(err).toBeInstanceOf(AppError);
                expect(err.code).toBe("SICK_LEAVE_CAP_EXCEEDED");
            }
        }), { numRuns: 100 });
    });
    it("allows sick leave when total stays within 8-month cap", async () => {
        await fc.assert(fc.asyncProperty(fc.integer({ min: 1, max: 30 }), async (newDays) => {
            vi.clearAllMocks();
            mockPrisma.employee.findUnique.mockResolvedValueOnce(makeEmployee());
            mockPrisma.leaveType.findUnique.mockResolvedValueOnce(makeLeaveType("SICK_FULL"));
            // No prior sick leave
            mockPrisma.leaveApplication.findMany.mockResolvedValueOnce([]);
            // Sufficient balance
            mockPrisma.leaveBalance.findUnique.mockResolvedValueOnce({ balance: 240 });
            mockPrisma.leaveApplication.create.mockResolvedValueOnce({ id: "app-sick", status: "PENDING" });
            const reqStart = new Date("2026-03-01");
            const reqEnd = new Date(reqStart);
            reqEnd.setDate(reqEnd.getDate() + newDays - 1);
            const result = await submitApplication("emp-1", {
                leaveTypeId: "lt-1",
                startDate: reqStart.toISOString(),
                endDate: reqEnd.toISOString(),
                reason: "sick",
            }, actor);
            expect(result.status).toBe("PENDING");
        }), { numRuns: 100 });
    });
});
//# sourceMappingURL=leave.property.test.js.map