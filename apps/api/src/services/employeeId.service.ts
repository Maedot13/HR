import { prisma } from "../lib/prisma.js";

/**
 * Generates a unique Employee ID in the format [CampusCode]-[Year]-[NNNNN].
 *
 * Uses a DB-level atomic upsert+increment on EmployeeIDCounter to guarantee
 * uniqueness even under concurrent requests.
 *
 * @param campusId - The UUID of the campus
 * @param year     - The calendar year (e.g. 2026)
 * @returns        Formatted ID, e.g. "BDU-2026-00045"
 */
export async function generate(campusId: string, year: number): Promise<string> {
  // Atomically increment (or create) the counter for this campus+year
  const counter = await prisma.$transaction(async (tx: typeof prisma) => {
    return tx.employeeIDCounter.upsert({
      where: { campusId_year: { campusId, year } },
      update: { sequence: { increment: 1 } },
      create: { campusId, year, sequence: 1 },
    });
  });

  // Fetch the campus code
  const campus = await prisma.campus.findUniqueOrThrow({
    where: { id: campusId },
    select: { code: true },
  });

  // Format: [CampusCode]-[Year]-[NNNNN]
  const sequence = String(counter.sequence).padStart(5, "0");
  return `${campus.code}-${year}-${sequence}`;
}
