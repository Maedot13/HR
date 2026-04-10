/**
 * Integration Test: Leave Balance Deduction End-to-End
 * Validates: Requirements 9.2, 9.3, 9.4
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  employee: { findUnique: vi.fn() },
  leaveType: { findUnique: vi.fn() },
  leaveBalance: { findUnique: vi.fn(), updateMany: vi.fn() },
  leaveApplication: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  activityLog: { create: vi.fn() },
}));

vi.mock("../lib/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../middleware/activityLogger.js", () => ({ logActivity: vi.fn() }));

import { submitApplication, approveApplication } from "../services/leave.service.js";

const actor = { userId: "actor-1", role: "HR_OFFICER", campusId: "campus-1", ipAddress: "127.0.0.1" };
const EMPLOYEE_ID = "emp-1";
const LEAVE_TYPE_ID = "lt-annual";
const APP_ID = "leave-app-1";

function makeEmployee() {
  return { id: EMPLOYEE_ID, employeeId: "BDU-2026-00001", fullName: "Test", academicRank: null, hireDate: new Date("2020-01-01"), status: "ACTIVE", campusId: "campus-1", userRole: { baseRole: "EMPLOYEE", specialPrivilege: null } };
}

function makeLeaveType(name = "ANNUAL") {
  return { id: LEAVE_TYPE_ID, name, description: "", maxDays: 30, payRate: 1.0 };
}

function makeApp(start: Date, end: Date, status = "PENDING") {
  return { id: APP_ID, employeeId: EMPLOYEE_ID, leaveTypeId: LEAVE_TYPE_ID, startDate: start, endDate: end, reason: "Vacation", status, supportingDocs: [], leaveType: makeLeaveType() };
}

function countWorkingDays(start: Date, end: Date): number {
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

describe("Integration: Leave Balance Deduction End-to-End", () => {
  beforeEach(() => vi.clearAllMocks());

  it("submits leave application with PENDING status", async () => {
    mockPrisma.employee.findUnique.mockResolvedValueOnce(makeEmployee());
    mockPrisma.leaveType.findUnique.mockResolvedValueOnce(makeLeaveType());
    mockPrisma.leaveBalance.findUnique.mockResolvedValueOnce({ balance: 20 });
    mockPrisma.leaveApplication.create.mockResolvedValueOnce(makeApp(new Date("2026-03-02"), new Date("2026-03-06")));
    const result = await submitApplication(EMPLOYEE_ID, { leaveTypeId: LEAVE_TYPE_ID, startDate: "2026-03-02", endDate: "2026-03-06", reason: "Vacation" }, actor);
    expect(result.status).toBe("PENDING");
  });

  it("approves application and deducts exact working days from balance", async () => {
    const start = new Date("2026-03-02");
    const end = new Date("2026-03-06");
    const expectedDays = countWorkingDays(start, end); // 5
    mockPrisma.leaveApplication.findUnique.mockResolvedValueOnce(makeApp(start, end));
    mockPrisma.leaveBalance.updateMany.mockResolvedValueOnce({ count: 1 });
    mockPrisma.leaveApplication.update.mockResolvedValueOnce(makeApp(start, end, "APPROVED"));
    const result = await approveApplication(APP_ID, actor);
    expect(result.status).toBe("APPROVED");
    expect(mockPrisma.leaveBalance.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { balance: { decrement: expectedDays } } }));
  });

  it("deducts exactly 3 working days for Mon-Wed leave", async () => {
    const start = new Date("2026-03-02");
    const end = new Date("2026-03-04");
    mockPrisma.leaveApplication.findUnique.mockResolvedValueOnce(makeApp(start, end));
    mockPrisma.leaveBalance.updateMany.mockResolvedValueOnce({ count: 1 });
    mockPrisma.leaveApplication.update.mockResolvedValueOnce(makeApp(start, end, "APPROVED"));
    await approveApplication(APP_ID, actor);
    expect(mockPrisma.leaveBalance.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { balance: { decrement: 3 } } }));
  });

  it("does not deduct balance for PATERNITY leave", async () => {
    const start = new Date("2026-03-02");
    const end = new Date("2026-03-06");
    const paternityApp = { ...makeApp(start, end), leaveType: makeLeaveType("PATERNITY") };
    mockPrisma.leaveApplication.findUnique.mockResolvedValueOnce(paternityApp);
    mockPrisma.leaveApplication.update.mockResolvedValueOnce({ ...paternityApp, status: "APPROVED" });
    const result = await approveApplication(APP_ID, actor);
    expect(result.status).toBe("APPROVED");
    expect(mockPrisma.leaveBalance.updateMany).not.toHaveBeenCalled();
  });

  it("full pipeline: submit → approve → balance decremented by exact duration", async () => {
    const start = new Date("2026-04-06");
    const end = new Date("2026-04-10");
    const expectedDays = countWorkingDays(start, end); // 5

    mockPrisma.employee.findUnique.mockResolvedValueOnce(makeEmployee());
    mockPrisma.leaveType.findUnique.mockResolvedValueOnce(makeLeaveType());
    mockPrisma.leaveBalance.findUnique.mockResolvedValueOnce({ balance: 15 });
    mockPrisma.leaveApplication.create.mockResolvedValueOnce(makeApp(start, end));
    const submitted = await submitApplication(EMPLOYEE_ID, { leaveTypeId: LEAVE_TYPE_ID, startDate: "2026-04-06", endDate: "2026-04-10", reason: "Annual leave" }, actor);
    expect(submitted.status).toBe("PENDING");

    mockPrisma.leaveApplication.findUnique.mockResolvedValueOnce(makeApp(start, end));
    mockPrisma.leaveBalance.updateMany.mockResolvedValueOnce({ count: 1 });
    mockPrisma.leaveApplication.update.mockResolvedValueOnce(makeApp(start, end, "APPROVED"));
    const approved = await approveApplication(APP_ID, actor);
    expect(approved.status).toBe("APPROVED");
    expect(mockPrisma.leaveBalance.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ employeeId: EMPLOYEE_ID, leaveTypeId: LEAVE_TYPE_ID }), data: { balance: { decrement: expectedDays } } }));
  });
});
