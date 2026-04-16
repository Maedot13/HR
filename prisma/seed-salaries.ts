/**
 * seed-salaries.ts
 *
 * Idempotent salary seeder for existing employees.
 * Uses the same @prisma/adapter-pg setup as apps/api/src/lib/prisma.ts.
 *
 * Run with (Node 22 required):
 *   bash -c 'source ~/.nvm/nvm.sh && nvm use 22 && npx tsx prisma/seed-salaries.ts'
 *
 * Assigns realistic base salaries (ETB/month) to every employee that does not
 * yet have an EmployeeSalary record. Existing records are NOT overwritten.
 *
 * Salary bands (approximate Bahir Dar University scale):
 *   ASSOCIATE_PROFESSOR → 32 000 ETB
 *   ASSISTANT_PROFESSOR → 24 000 ETB
 *   LECTURER            → 17 000 ETB
 *   SUPER_ADMIN         → 18 000 ETB
 *   ADMIN               → 16 000 ETB
 *   HR_OFFICER          → 14 000 ETB
 *   EMPLOYEE (default)  → 10 000 ETB
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { randomUUID } from "crypto";

// ─── Prisma client (mirrors apps/api/src/lib/prisma.ts) ──────────────────────

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set. Check your .env file.");

const pool = new pg.Pool({
  connectionString: url,
  connectionTimeoutMillis: 30_000,
  idleTimeoutMillis: 60_000,
  max: 5,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

// ─── Salary band lookup ───────────────────────────────────────────────────────

function baseSalaryFor(
  academicRank: string | null,
  baseRole: string | null
): number {
  if (academicRank === "ASSOCIATE_PROFESSOR") return 32_000;
  if (academicRank === "ASSISTANT_PROFESSOR")  return 24_000;
  if (academicRank === "LECTURER")             return 17_000;
  if (baseRole     === "SUPER_ADMIN")          return 18_000;
  if (baseRole     === "ADMIN")                return 16_000;
  if (baseRole     === "HR_OFFICER")           return 14_000;
  return 10_000; // EMPLOYEE default
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Fetching employees…");

  const employees = await (prisma as any).employee.findMany({
    include: {
      UserRole: true,
      EmployeeSalary: { orderBy: { effectiveFrom: "desc" }, take: 1 },
    },
  });

  console.log(`  Found ${employees.length} employee(s).`);

  let created = 0;
  let skipped = 0;

  for (const emp of employees as any[]) {
    // Skip employees that already have at least one salary record
    if (emp.EmployeeSalary.length > 0) {
      skipped++;
      continue;
    }

    const salary = baseSalaryFor(
      emp.academicRank ?? null,
      emp.UserRole?.baseRole ?? null
    );

    await (prisma as any).employeeSalary.create({
      data: {
        id:            randomUUID(),
        employeeId:    emp.id,
        baseSalary:    salary,
        bonus:         0,
        penalty:       0,
        effectiveFrom: emp.hireDate ?? emp.createdAt,
      },
    });

    console.log(
      `  ✓ ${(emp.employeeId as string).padEnd(20)}` +
      ` ${(emp.fullName as string).padEnd(30)}` +
      ` → ${salary.toLocaleString()} ETB/mo`
    );
    created++;
  }

  console.log(
    `\nDone. Created: ${created}  |  Already had salary: ${skipped}`
  );
}

main()
  .catch((e) => {
    console.error("Seeder failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await (prisma as any).$disconnect();
    await pool.end();
  });
