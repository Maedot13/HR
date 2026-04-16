import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { logActivity } from "../middleware/activityLogger.js";
import {
  writePayrollExcel,
  writePayrollPDF,
  writePayrollDOCX,
  type SalaryRow,
} from "../lib/fileGenerator.js";

export interface ActorContext {
  userId: string;
  role: string;
  specialPrivilege?: string;
  campusId: string;
  ipAddress: string;
}

// ─── Period validation ────────────────────────────────────────────────────────

const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Generate a payroll report for the given period.
 *
 * Compiles salary + bonus + penalty data for ALL active employees at the time
 * of generation and stores the snapshot as JSON on the report record so that
 * subsequent exports always reflect the data at generation time.
 */
export async function generateReport(period: string, actor: ActorContext) {
  // Validate period format YYYY-MM
  if (!PERIOD_REGEX.test(period)) {
    throw new AppError(
      422,
      "VALIDATION_ERROR",
      "period must be in YYYY-MM format (e.g. 2026-03)"
    );
  }

  try {
    // Fetch all active employees with their most recent salary record
    const employees = await prisma.employee.findMany({
      where: { status: "ACTIVE" },
      include: {
        EmployeeSalary: {
          orderBy: { effectiveFrom: "desc" },
          take: 1,
        },
      },
    });

    // Build salary snapshot rows
    const dataSnapshot: SalaryRow[] = employees.map((emp) => {
      const sal = emp.EmployeeSalary[0];
      const baseSalary = sal?.baseSalary ?? 0;
      const bonus      = sal?.bonus      ?? 0;
      const penalty    = sal?.penalty    ?? 0;
      return {
        employeeId: emp.employeeId,
        fullName:   emp.fullName,
        baseSalary,
        bonus,
        penalty,
        netPay: baseSalary + bonus - penalty,
      };
    });

    const report = await prisma.payrollReport.create({
      data: {
        period,
        generatedBy: actor.userId,
        status: "DRAFT",
        dataSnapshot: dataSnapshot as unknown as object,
      },
    });

    await logActivity({
      actingUserId: actor.userId,
      actingRole:   actor.role,
      actionType:   "PAYROLL_REPORT_GENERATED",
      resourceType: "PayrollReport",
      resourceId:   report.id,
      newState: {
        period,
        status: "DRAFT",
        employeeCount: dataSnapshot.length,
      },
      ipAddress: actor.ipAddress,
    });

    return report;
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error("[PayrollService] Report generation failed:", error);
    throw new AppError(
      500,
      "REPORT_GENERATION_FAILED",
      "Unable to generate payroll report. Please try again or contact support."
    );
  }
}

export async function getReport(id: string) {
  const report = await prisma.payrollReport.findUnique({
    where: { id },
    include: { PayrollExport: true },
  });
  if (!report) {
    throw new AppError(404, "NOT_FOUND", "Payroll report not found.");
  }
  return report;
}

export async function listReports() {
  return prisma.payrollReport.findMany({
    orderBy: { generatedAt: "desc" },
    include: { PayrollExport: true },
  });
}

/**
 * Export a payroll report in the requested format.
 *
 * Reads the salary snapshot stored on the report and writes a real
 * Excel (.xlsx), PDF, or DOCX file to uploads/exports/.
 * Returns an export record whose fileUrl is served by express.static.
 */
export async function exportReport(
  reportId: string,
  format: "EXCEL" | "PDF" | "DOCX",
  actor: ActorContext
) {
  try {
    const report = await prisma.payrollReport.findUnique({ where: { id: reportId } });
    if (!report) {
      throw new AppError(404, "NOT_FOUND", "Payroll report not found.");
    }

    // Load the salary rows that were compiled at generation time
    const rows: SalaryRow[] = Array.isArray(report.dataSnapshot)
      ? (report.dataSnapshot as unknown as SalaryRow[])
      : [];

    // Generate the file extension
    const ext =
      format === "EXCEL" ? "xlsx" : format.toLowerCase();
    const filename = `${reportId}-${Date.now()}.${ext}`;

    let fileUrl: string;
    try {
      if (format === "EXCEL") {
        fileUrl = await writePayrollExcel(filename, report.period, rows);
      } else if (format === "PDF") {
        fileUrl = await writePayrollPDF(filename, report.period, rows);
      } else {
        fileUrl = await writePayrollDOCX(filename, report.period, rows);
      }
    } catch (genErr) {
      console.error("[PayrollService] File write failed:", genErr);
      throw new AppError(
        500,
        "FILE_GENERATION_FAILED",
        `Unable to write the ${format} export file. Please try again.`
      );
    }

    const exportRecord = await prisma.payrollExport.create({
      data: { payrollReportId: reportId, format, fileUrl },
    });

    await logActivity({
      actingUserId: actor.userId,
      actingRole:   actor.role,
      actionType:   "PAYROLL_REPORT_EXPORTED",
      resourceType: "PayrollExport",
      resourceId:   exportRecord.id,
      newState:     { reportId, format, fileUrl },
      ipAddress:    actor.ipAddress,
    });

    return exportRecord;
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error("[PayrollService] Export failed:", error);
    throw new AppError(
      500,
      "EXPORT_FAILED",
      `Unable to export payroll report in ${format} format. Please try again or contact support.`
    );
  }
}

export async function validateReport(reportId: string, actor: ActorContext) {
  const report = await prisma.payrollReport.findUnique({ where: { id: reportId } });
  if (!report) {
    throw new AppError(404, "NOT_FOUND", "Payroll report not found.");
  }
  const updated = await prisma.payrollReport.update({
    where: { id: reportId },
    data: { status: "VALIDATED" },
  });
  await logActivity({
    actingUserId:  actor.userId,
    actingRole:    actor.role,
    actionType:    "PAYROLL_REPORT_VALIDATED",
    resourceType:  "PayrollReport",
    resourceId:    reportId,
    previousState: { status: report.status },
    newState:      { status: "VALIDATED" },
    ipAddress:     actor.ipAddress,
  });
  return updated;
}
