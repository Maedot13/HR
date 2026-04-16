import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { logActivity } from "../middleware/activityLogger.js";
import {
  writeLetterPDF,
  writeLetterDOCX,
  type LetterData,
} from "../lib/fileGenerator.js";

export interface ActorContext {
  userId: string;
  role: string;
  specialPrivilege?: string;
  campusId: string;
  ipAddress: string;
}

function computeDuration(start: Date | null, end: Date | null): string {
  if (!start || !end) return "N/A";
  const totalDays = Math.floor(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (totalDays <= 0) return "0 days";
  const years  = Math.floor(totalDays / 365);
  const months = Math.floor((totalDays % 365) / 30);
  const days   = totalDays % 30;
  const parts: string[] = [];
  if (years  > 0) parts.push(`${years} year${years   !== 1 ? "s" : ""}`);
  if (months > 0) parts.push(`${months} month${months !== 1 ? "s" : ""}`);
  if (days   > 0) parts.push(`${days} day${days     !== 1 ? "s" : ""}`);
  return parts.length > 0 ? parts.join(", ") : "0 days";
}

/**
 * Generate an experience letter (PDF or DOCX) for a departing employee.
 *
 * Accepts either the internal UUID or the formatted employeeId (e.g. AAU-2026-00045).
 * Writes a real file to uploads/letters/ and returns the record plus download URL.
 */
export async function generateExperienceLetter(
  employeeRef: string,
  format: "PDF" | "DOCX",
  actor: ActorContext
) {
  // ── 1. Resolve employee by UUID or formatted ID ───────────────────────────
  let employee = await prisma.employee.findUnique({
    where: { id: employeeRef },
    include: {
      EmploymentHistory: { orderBy: { changedAt: "desc" } },
      UserRole: true,
    },
  });

  if (!employee) {
    // Try formatted ID (e.g. "AAU-2026-00045")
    employee = await prisma.employee.findUnique({
      where: { employeeId: employeeRef },
      include: {
        EmploymentHistory: { orderBy: { changedAt: "desc" } },
        UserRole: true,
      },
    });
  }

  if (!employee) {
    throw new AppError(
      404,
      "NOT_FOUND",
      "Unable to generate experience letter. Employee not found. " +
        "Provide either the internal UUID or the formatted ID (e.g. AAU-2026-00045)."
    );
  }

  // ── 2. Eligibility guard: only for departing / separated employees ─────────
  if (employee.status === "ACTIVE" && !employee.endDate) {
    throw new AppError(
      422,
      "NOT_ELIGIBLE",
      "Experience letters can only be generated for employees who have separated " +
        "from the university (status Inactive or with an end date set)."
    );
  }

  // ── 3. Derive position title ───────────────────────────────────────────────
  // Priority: EmploymentHistory 'position' entry → role display name → fallback
  const positionEntry = employee.EmploymentHistory.find(
    (h) => h.changeType === "position"
  );
  const positionTitle =
    positionEntry?.newValue ??
    (employee.UserRole?.baseRole
      ? employee.UserRole.baseRole.replace(/_/g, " ")
      : "Staff Member");

  // ── 4. Compute service duration ────────────────────────────────────────────
  const hireDate = employee.hireDate ?? employee.createdAt;
  const endDate  = employee.endDate  ?? new Date();
  const duration = computeDuration(hireDate, endDate);

  // ── 5. Generate the actual file ────────────────────────────────────────────
  const filename = `${employee.employeeId}-${Date.now()}.${format.toLowerCase()}`;
  const letterData: LetterData = {
    fullName: employee.fullName,
    positionTitle,
    hireDate,
    endDate,
    duration,
    generatedAt: new Date(),
  };

  let fileUrl: string;
  try {
    fileUrl =
      format === "PDF"
        ? await writeLetterPDF(filename, letterData)
        : await writeLetterDOCX(filename, letterData);
  } catch (err) {
    console.error("[DocumentService] File generation failed:", err);
    throw new AppError(
      500,
      "FILE_GENERATION_FAILED",
      "The experience letter could not be generated. Please try again or contact support."
    );
  }

  // ── 6. Persist record ──────────────────────────────────────────────────────
  const letter = await prisma.experienceLetter.create({
    data: { employeeId: employee.id, generatedBy: actor.userId, format, fileUrl },
  });

  await logActivity({
    actingUserId: actor.userId,
    actingRole:   actor.role,
    actionType:   "EXPERIENCE_LETTER_GENERATED",
    resourceType: "ExperienceLetter",
    resourceId:   letter.id,
    newState: {
      employeeId:    employee.employeeId,
      fullName:      employee.fullName,
      positionTitle,
      duration,
      format,
      fileUrl,
    },
    ipAddress: actor.ipAddress,
  });

  return {
    ...letter,
    fullName: employee.fullName,
    positionTitle,
    hireDate,
    endDate,
    duration,
  };
}

/**
 * List all experience letters for a given employee.
 * Accepts internal UUID or formatted employeeId.
 */
export async function listExperienceLetters(employeeRef: string) {
  // Resolve by UUID first, then formatted ID
  let employee = await prisma.employee.findUnique({ where: { id: employeeRef } });
  if (!employee) {
    employee = await prisma.employee.findUnique({ where: { employeeId: employeeRef } });
  }
  if (!employee) {
    throw new AppError(
      404,
      "NOT_FOUND",
      "Unable to retrieve experience letters. Employee not found."
    );
  }
  return prisma.experienceLetter.findMany({
    where: { employeeId: employee.id },
    orderBy: { generatedAt: "desc" },
  });
}
