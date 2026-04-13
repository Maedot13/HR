import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { logActivity } from "../middleware/activityLogger.js";

export interface ActorContext {
  userId: string;
  role: string;
  specialPrivilege?: string;
  campusId: string;
  ipAddress: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Count working days between two dates (Mon–Fri) */
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

/** Count calendar days between two dates (inclusive) */
function countCalendarDays(start: Date, end: Date): number {
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

/** Years of service from hireDate to now */
function yearsOfService(hireDate: Date): number {
  const now = new Date();
  return Math.floor((now.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}

/** Annual leave entitlement: min(19 + yearsOfService, 30) */
export function annualLeaveEntitlement(years: number): number {
  return Math.min(19 + years, 30);
}

// ─── Leave types ──────────────────────────────────────────────────────────────

const ACADEMIC_RANKS = ["LECTURER", "ASSISTANT_PROFESSOR", "ASSOCIATE_PROFESSOR"];
const SENIOR_RANKS = ["ASSISTANT_PROFESSOR", "ASSOCIATE_PROFESSOR"];

// ─── Service functions ────────────────────────────────────────────────────────

export async function getLeaveTypes() {
  return prisma.leaveType.findMany({ orderBy: { name: "asc" } });
}

export async function getLeaveBalances(employeeId: string, year?: number) {
  const y = year ?? new Date().getFullYear();
  return prisma.leaveBalance.findMany({
    where: { employeeId, year: y },
    include: { LeaveType: true },
  });
}

export async function submitApplication(
  employeeId: string,
  data: {
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    reason: string;
    supportingDocs?: string[];
  },
  actor: ActorContext
) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { UserRole: true },
  });
  if (!employee) throw new AppError(404, "NOT_FOUND", "Employee record not found. Please verify the Employee ID and try again.");

  const leaveType = await prisma.leaveType.findUnique({ where: { id: data.leaveTypeId } });
  if (!leaveType) throw new AppError(404, "NOT_FOUND", "The selected leave type could not be found. Please choose a different type or contact HR.");

  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  const year = start.getFullYear();

  // ── Eligibility checks ────────────────────────────────────────────────────

  if (leaveType.name === "RESEARCH") {
    const unmet: string[] = [];
    if (!SENIOR_RANKS.includes(employee.academicRank ?? "")) {
      unmet.push("rank must be Assistant Professor or above");
    }
    const svc = employee.hireDate ? yearsOfService(employee.hireDate) : 0;
    if (svc < 3) unmet.push("requires at least 3 consecutive years of service");
    if (unmet.length > 0) {
      throw new AppError(422, "LEAVE_ELIGIBILITY_FAILED", "You do not meet the eligibility requirements for Research Leave. Please contact HR for details.", { unmetCriteria: unmet });
    }
  }

  if (leaveType.name === "SABBATICAL") {
    const unmet: string[] = [];
    if (!ACADEMIC_RANKS.includes(employee.academicRank ?? "")) {
      unmet.push("must be full-time Academic Staff");
    }
    if (!SENIOR_RANKS.includes(employee.academicRank ?? "")) {
      unmet.push("rank must be Assistant Professor or above");
    }
    const svc = employee.hireDate ? yearsOfService(employee.hireDate) : 0;
    if (svc < 6) unmet.push("requires at least 6 continuous years of service");
    if (unmet.length > 0) {
      throw new AppError(422, "LEAVE_ELIGIBILITY_FAILED", "You do not meet the eligibility requirements for Sabbatical Leave. Please contact HR for details.", { unmetCriteria: unmet });
    }
  }

  if (leaveType.name === "LEAVE_WITHOUT_PAY") {
    if (actor.specialPrivilege !== "UNIVERSITY_PRESIDENT") {
      throw new AppError(403, "LEAVE_ELIGIBILITY_FAILED", "Leave without pay requires approval from the University President. Please submit your request through the appropriate channel.");
    }
  }

  // ── Balance check ─────────────────────────────────────────────────────────

  const requestedDays = ["MATERNITY_PRENATAL", "MATERNITY_POSTNATAL", "SICK_FULL", "SICK_HALF"]
    .includes(leaveType.name)
    ? countCalendarDays(start, end)
    : countWorkingDays(start, end);

  // Sick leave 8-month cap check
  if (leaveType.name === "SICK_FULL" || leaveType.name === "SICK_HALF") {
    const rollingStart = new Date(start);
    rollingStart.setFullYear(rollingStart.getFullYear() - 1);

    const existingSick = await prisma.leaveApplication.findMany({
      where: {
        employeeId,
        LeaveType: { name: { in: ["SICK_FULL", "SICK_HALF"] } },
        status: "APPROVED",
        startDate: { gte: rollingStart },
        endDate: { lte: start },
      },
      include: { LeaveType: true },
    });

    const usedDays = existingSick.reduce((sum: number, app: { startDate: Date; endDate: Date }) => {
      return sum + countCalendarDays(app.startDate, app.endDate);
    }, 0);

    const MAX_SICK_DAYS = 8 * 30; // ~8 months in calendar days
    if (usedDays + requestedDays > MAX_SICK_DAYS) {
      throw new AppError(422, "SICK_LEAVE_CAP_EXCEEDED", "This request would exceed the maximum sick leave allowed (8 months within any 12-month period). Please contact HR to review your leave balance.");
    }
  }

  // Annual leave: Academic staff outside July–August needs approval flag
  let requiresApproval = false;
  if (leaveType.name === "ANNUAL" && ACADEMIC_RANKS.includes(employee.academicRank ?? "")) {
    const month = start.getMonth(); // 0-indexed: June=6, July=7
    if (month < 6 || month > 7) requiresApproval = true;
  }

  // Balance check (skip for types without balance tracking)
  const skipBalanceCheck = ["MATERNITY_PRENATAL", "MATERNITY_POSTNATAL", "PATERNITY",
    "PERSONAL", "SPECIAL", "LEAVE_WITHOUT_PAY", "STUDY", "RESEARCH", "SABBATICAL", "SEMINAR"].includes(leaveType.name);

  if (!skipBalanceCheck) {
    const balance = await prisma.leaveBalance.findUnique({
      where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId: data.leaveTypeId, year } },
    });
    const currentBalance = balance?.balance ?? 0;
    if (currentBalance < requestedDays) {
      throw new AppError(422, "INSUFFICIENT_LEAVE_BALANCE", "You do not have enough leave days remaining for this request.", {
        currentBalance,
        shortfall: requestedDays - currentBalance,
      });
    }
  }

  const application = await prisma.leaveApplication.create({
    data: {
      employeeId,
      leaveTypeId: data.leaveTypeId,
      startDate: start,
      endDate: end,
      reason: data.reason,
      status: "PENDING",
      supportingDocs: data.supportingDocs ?? [],
    },
  });

  await logActivity({
    actingUserId: actor.userId,
    actingRole: actor.role,
    actionType: "LEAVE_APPLICATION_SUBMITTED",
    resourceType: "LeaveApplication",
    resourceId: application.id,
    newState: { leaveType: leaveType.name, startDate: data.startDate, endDate: data.endDate, requiresApproval },
    ipAddress: actor.ipAddress,
  });

  return { ...application, requiresApproval };
}

export async function approveApplication(applicationId: string, actor: ActorContext) {
  const application = await prisma.leaveApplication.findUnique({
    where: { id: applicationId },
    include: { LeaveType: true },
  });
  if (!application) throw new AppError(404, "NOT_FOUND", "Leave application not found. It may have been withdrawn or never submitted.");
  if (application.status !== "PENDING") {
    throw new AppError(422, "INVALID_STATUS", "This application has already been reviewed and can no longer be approved. Only pending applications can be approved.");
  }

  const start = application.startDate;
  const end = application.endDate;
  const year = start.getFullYear();

  const deductDays = ["MATERNITY_PRENATAL", "MATERNITY_POSTNATAL", "SICK_FULL", "SICK_HALF"]
    .includes(application.LeaveType.name)
    ? countCalendarDays(start, end)
    : countWorkingDays(start, end);

  // Deduct from balance if tracked
  const skipDeduction = ["MATERNITY_PRENATAL", "MATERNITY_POSTNATAL", "PATERNITY",
    "PERSONAL", "SPECIAL", "LEAVE_WITHOUT_PAY", "STUDY", "RESEARCH", "SABBATICAL", "SEMINAR"].includes(application.LeaveType.name);

  if (!skipDeduction) {
    await prisma.leaveBalance.updateMany({
      where: { employeeId: application.employeeId, leaveTypeId: application.leaveTypeId, year },
      data: { balance: { decrement: deductDays } },
    });
  }

  const updated = await prisma.leaveApplication.update({
    where: { id: applicationId },
    data: { status: "APPROVED", approvedBy: actor.userId, approvedAt: new Date() },
  });

  await logActivity({
    actingUserId: actor.userId,
    actingRole: actor.role,
    actionType: "LEAVE_APPROVED",
    resourceType: "LeaveApplication",
    resourceId: applicationId,
    previousState: { status: "PENDING" },
    newState: { status: "APPROVED", deductedDays: deductDays },
    ipAddress: actor.ipAddress,
  });

  return updated;
}

export async function rejectApplication(
  applicationId: string,
  rejectionReason: string,
  actor: ActorContext
) {
  const application = await prisma.leaveApplication.findUnique({ where: { id: applicationId } });
  if (!application) throw new AppError(404, "NOT_FOUND", "Leave application not found. It may have been withdrawn or never submitted.");
  if (application.status !== "PENDING") {
    throw new AppError(422, "INVALID_STATUS", "This application has already been reviewed and can no longer be rejected. Only pending applications can be rejected.");
  }

  const updated = await prisma.leaveApplication.update({
    where: { id: applicationId },
    data: { status: "REJECTED", rejectionReason },
  });

  await logActivity({
    actingUserId: actor.userId,
    actingRole: actor.role,
    actionType: "LEAVE_REJECTED",
    resourceType: "LeaveApplication",
    resourceId: applicationId,
    previousState: { status: "PENDING" },
    newState: { status: "REJECTED", rejectionReason },
    ipAddress: actor.ipAddress,
  });

  return updated;
}

export async function listApplications(employeeId: string) {
  return prisma.leaveApplication.findMany({
    where: { employeeId },
    include: { LeaveType: true },
    orderBy: { createdAt: "desc" },
  });
}
