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

function computeDuration(start: Date, end: Date): string {
  const totalDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const years = Math.floor(totalDays / 365);
  const months = Math.floor((totalDays % 365) / 30);
  const days = totalDays % 30;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} year${years !== 1 ? "s" : ""}`);
  if (months > 0) parts.push(`${months} month${months !== 1 ? "s" : ""}`);
  if (days > 0) parts.push(`${days} day${days !== 1 ? "s" : ""}`);
  return parts.length > 0 ? parts.join(", ") : "0 days";
}

export async function generateExperienceLetter(employeeId: string, format: "PDF" | "DOCX", actor: ActorContext) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { EmploymentHistory: { orderBy: { changedAt: "desc" } } },
  });
  if (!employee) throw new AppError(404, "NOT_FOUND", "Employee not found");

  const mostRecentPosition = employee.EmploymentHistory.find((h: { changeType: string; newValue: string }) => h.changeType === "position");
  const positionTitle = mostRecentPosition?.newValue ?? "N/A";
  const hireDate = employee.hireDate ?? employee.createdAt;
  const endDate = employee.endDate ?? new Date();
  const duration = computeDuration(hireDate, endDate);
  const fileUrl = `/letters/${employeeId}-${Date.now()}.${format.toLowerCase()}`;

  const letter = await prisma.experienceLetter.create({ data: { employeeId, generatedBy: actor.userId, format, fileUrl } });

  await logActivity({ actingUserId: actor.userId, actingRole: actor.role, actionType: "EXPERIENCE_LETTER_GENERATED", resourceType: "ExperienceLetter", resourceId: letter.id, newState: { employeeId, fullName: employee.fullName, positionTitle, duration, format, fileUrl }, ipAddress: actor.ipAddress });

  return { ...letter, fullName: employee.fullName, positionTitle, hireDate, endDate, duration };
}

export async function listExperienceLetters(employeeId: string) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new AppError(404, "NOT_FOUND", "Employee not found");
  return prisma.experienceLetter.findMany({ where: { employeeId }, orderBy: { generatedAt: "desc" } });
}
