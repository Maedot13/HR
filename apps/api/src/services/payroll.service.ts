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

export async function generateReport(period: string, actor: ActorContext) {
  // ADDED: Try-catch wrapper for database operations
  try {
    const report = await prisma.payrollReport.create({ data: { period, generatedBy: actor.userId, status: "DRAFT" } });
    await logActivity({ actingUserId: actor.userId, actingRole: actor.role, actionType: "PAYROLL_REPORT_GENERATED", resourceType: "PayrollReport", resourceId: report.id, newState: { period, status: "DRAFT" }, ipAddress: actor.ipAddress });
    return report;
  } catch (error) {
    // ADDED: Graceful error handling
    console.error('[PayrollService] Report generation failed:', error);
    throw new AppError(
      500,
      "REPORT_GENERATION_FAILED",
      "Unable to generate payroll report. Please try again or contact support."
    );
  }
}

export async function getReport(id: string) {
  const report = await prisma.payrollReport.findUnique({ where: { id }, include: { PayrollExport: true } });
  if (!report) {
    throw new AppError(404, "NOT_FOUND", "Unable to retrieve payroll report. Report not found.");
  }
  return report;
}

export async function listReports() {
  return prisma.payrollReport.findMany({ orderBy: { generatedAt: "desc" }, include: { PayrollExport: true } });
}

export async function exportReport(reportId: string, format: "EXCEL" | "PDF" | "DOCX", actor: ActorContext) {
  // ADDED: Try-catch wrapper for database operations
  try {
    const report = await prisma.payrollReport.findUnique({ where: { id: reportId } });
    
    // IMPROVED: User-friendly error message
    if (!report) {
      throw new AppError(404, "NOT_FOUND", "Unable to export payroll report. Report not found.");
    }
    
    const fileUrl = `/exports/${reportId}.${format.toLowerCase()}`;
    const exportRecord = await prisma.payrollExport.create({ 
      data: { payrollReportId: reportId, format, fileUrl } 
    });
    
    await logActivity({ 
      actingUserId: actor.userId, 
      actingRole: actor.role, 
      actionType: "PAYROLL_REPORT_EXPORTED", 
      resourceType: "PayrollExport", 
      resourceId: exportRecord.id, 
      newState: { reportId, format, fileUrl }, 
      ipAddress: actor.ipAddress 
    });
    
    return exportRecord;
  } catch (error) {
    // ADDED: Graceful error handling
    if (error instanceof AppError) throw error;
    
    // Log internal error but return user-friendly message
    console.error('[PayrollService] Export failed:', error);
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
    throw new AppError(404, "NOT_FOUND", "Unable to validate payroll report. Report not found.");
  }
  const updated = await prisma.payrollReport.update({ where: { id: reportId }, data: { status: "VALIDATED" } });
  await logActivity({ actingUserId: actor.userId, actingRole: actor.role, actionType: "PAYROLL_REPORT_VALIDATED", resourceType: "PayrollReport", resourceId: reportId, previousState: { status: report.status }, newState: { status: "VALIDATED" }, ipAddress: actor.ipAddress });
  return updated;
}
