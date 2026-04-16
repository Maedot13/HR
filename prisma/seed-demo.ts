/**
 * seed-demo.ts — Demo users for RBAC testing & presentation
 *
 * Creates 10 demo employees across all 4 roles, 2 campuses, realistic org
 * structure, and salary records. Fully idempotent — safe to re-run.
 *
 * Default password for ALL demo users: Demo@2024
 *
 * Run with (Node 22 required for Prisma 7):
 *   bash -c 'source ~/.nvm/nvm.sh && nvm use 22 && npx tsx prisma/seed-demo.ts'
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg }     from "@prisma/adapter-pg";
import pg               from "pg";
import bcrypt           from "bcrypt";
import { randomUUID }   from "crypto";

// ─── Prisma setup (mirrors apps/api/src/lib/prisma.ts) ───────────────────────

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set.");

const pool    = new pg.Pool({ connectionString: url, connectionTimeoutMillis: 30_000, max: 5 });
const adapter = new PrismaPg(pool);
const prisma  = new PrismaClient({ adapter } as any) as any;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const now  = new Date();
const id   = () => randomUUID();

async function hashPw(plain: string) {
  return bcrypt.hash(plain, 12);
}

// ─── Demo password ────────────────────────────────────────────────────────────

const DEMO_PASSWORD = "Demo@2024";

// ─── Org structure ────────────────────────────────────────────────────────────

// Campus 1 — already exists but we upsert safely
const MAIN_CAMPUS_CODE = "MAIN";
const MAIN_CAMPUS_NAME = "Bahir Dar Main Campus";

// Campus 2 — new
const TECH_CAMPUS_CODE = "TECH";
const TECH_CAMPUS_NAME = "Science & Technology Campus";

// ─── Demo user definitions ────────────────────────────────────────────────────
//
// Role chart:
//   SUPER_ADMIN  (2) — full system access, no campus scope
//   ADMIN        (3) — campus-scoped management; some with special privileges
//   HR_OFFICER   (2) — HR operations; payroll & experience letters
//   EMPLOYEE     (3) — self-service; varied academic ranks
//
// Employee IDs use sequences ≥ 10 on MAIN (existing max is 5) to avoid clash.

interface DemoUser {
  employeeId:      string;
  fullName:        string;
  email:           string;
  campusCode:      string;
  gender:          "MALE" | "FEMALE" | "OTHER";
  dateOfBirth:     string;
  nationality:     string;
  hireDate:        string;
  status:          "ACTIVE" | "PENDING";
  academicRank?:   "LECTURER" | "ASSISTANT_PROFESSOR" | "ASSOCIATE_PROFESSOR";
  baseRole:        "SUPER_ADMIN" | "ADMIN" | "HR_OFFICER" | "EMPLOYEE";
  specialPrivilege?: "DEAN" | "DIRECTOR" | "VICE_PRESIDENT" | "UNIVERSITY_PRESIDENT";
  departmentCode?: string;  // internal key into departments map
  baseSalary:      number;
}

const DEMO_USERS: DemoUser[] = [
  // ── SUPER_ADMIN ─────────────────────────────────────────────────────────────
  {
    employeeId:   "MAIN-2026-00010",
    fullName:     "Abebe Kebede",
    email:        "abebe.kebede@bdu.edu.et",
    campusCode:   MAIN_CAMPUS_CODE,
    gender:       "MALE",
    dateOfBirth:  "1975-03-12",
    nationality:  "Ethiopian",
    hireDate:     "2010-09-01",
    status:       "ACTIVE",
    baseRole:     "SUPER_ADMIN",
    baseSalary:   18_000,
  },
  {
    employeeId:   "MAIN-2026-00011",
    fullName:     "Tigist Alemu",
    email:        "tigist.alemu@bdu.edu.et",
    campusCode:   MAIN_CAMPUS_CODE,
    gender:       "FEMALE",
    dateOfBirth:  "1980-07-22",
    nationality:  "Ethiopian",
    hireDate:     "2012-09-01",
    status:       "ACTIVE",
    baseRole:     "SUPER_ADMIN",
    baseSalary:   18_000,
  },

  // ── ADMIN ────────────────────────────────────────────────────────────────────
  {
    employeeId:      "MAIN-2026-00012",
    fullName:        "Dawit Haile",
    email:           "dawit.haile@bdu.edu.et",
    campusCode:      MAIN_CAMPUS_CODE,
    gender:          "MALE",
    dateOfBirth:     "1972-11-05",
    nationality:     "Ethiopian",
    hireDate:        "2003-09-01",
    status:          "ACTIVE",
    baseRole:        "ADMIN",
    specialPrivilege:"DEAN",
    departmentCode:  "MAIN_MGMT",
    baseSalary:      24_000,   // Academy-level admin
  },
  {
    employeeId:      "TECH-2026-00001",
    fullName:        "Meron Teshome",
    email:           "meron.teshome@bdu.edu.et",
    campusCode:      TECH_CAMPUS_CODE,
    gender:          "FEMALE",
    dateOfBirth:     "1978-02-18",
    nationality:     "Ethiopian",
    hireDate:        "2008-09-01",
    status:          "ACTIVE",
    baseRole:        "ADMIN",
    specialPrivilege:"DIRECTOR",
    departmentCode:  "TECH_CS",
    baseSalary:      16_000,
  },
  {
    employeeId:   "TECH-2026-00002",
    fullName:     "Aisha Yimam",
    email:        "aisha.yimam@bdu.edu.et",
    campusCode:   TECH_CAMPUS_CODE,
    gender:       "FEMALE",
    dateOfBirth:  "1982-05-30",
    nationality:  "Ethiopian",
    hireDate:     "2011-09-01",
    status:       "ACTIVE",
    baseRole:     "ADMIN",
    departmentCode:"TECH_CS",
    baseSalary:   16_000,
  },

  // ── HR_OFFICER ───────────────────────────────────────────────────────────────
  {
    employeeId:   "MAIN-2026-00013",
    fullName:     "Yonas Girma",
    email:        "yonas.girma@bdu.edu.et",
    campusCode:   MAIN_CAMPUS_CODE,
    gender:       "MALE",
    dateOfBirth:  "1985-09-14",
    nationality:  "Ethiopian",
    hireDate:     "2015-09-01",
    status:       "ACTIVE",
    baseRole:     "HR_OFFICER",
    departmentCode:"MAIN_MGMT",
    baseSalary:   14_000,
  },
  {
    employeeId:   "TECH-2026-00003",
    fullName:     "Hiwot Tadesse",
    email:        "hiwot.tadesse@bdu.edu.et",
    campusCode:   TECH_CAMPUS_CODE,
    gender:       "FEMALE",
    dateOfBirth:  "1988-04-27",
    nationality:  "Ethiopian",
    hireDate:     "2016-09-01",
    status:       "ACTIVE",
    baseRole:     "HR_OFFICER",
    departmentCode:"TECH_CS",
    baseSalary:   14_000,
  },

  // ── EMPLOYEE ─────────────────────────────────────────────────────────────────
  {
    employeeId:   "MAIN-2026-00014",
    fullName:     "Bekele Worku",
    email:        "bekele.worku@bdu.edu.et",
    campusCode:   MAIN_CAMPUS_CODE,
    gender:       "MALE",
    dateOfBirth:  "1990-01-10",
    nationality:  "Ethiopian",
    hireDate:     "2019-09-01",
    status:       "ACTIVE",
    academicRank: "LECTURER",
    baseRole:     "EMPLOYEE",
    departmentCode:"MAIN_MGMT",
    baseSalary:   17_000,
  },
  {
    employeeId:      "MAIN-2026-00015",
    fullName:        "Sara Mulat",
    email:           "sara.mulat@bdu.edu.et",
    campusCode:      MAIN_CAMPUS_CODE,
    gender:          "FEMALE",
    dateOfBirth:     "1986-06-03",
    nationality:     "Ethiopian",
    hireDate:        "2014-09-01",
    status:          "ACTIVE",
    academicRank:    "ASSISTANT_PROFESSOR",
    baseRole:        "EMPLOYEE",
    specialPrivilege:"DEAN",
    departmentCode:  "MAIN_MGMT",
    baseSalary:      24_000,
  },
  {
    employeeId:   "TECH-2026-00004",
    fullName:     "Feven Hailu",
    email:        "feven.hailu@bdu.edu.et",
    campusCode:   TECH_CAMPUS_CODE,
    gender:       "FEMALE",
    dateOfBirth:  "1979-08-19",
    nationality:  "Ethiopian",
    hireDate:     "2007-09-01",
    status:       "ACTIVE",
    academicRank: "ASSOCIATE_PROFESSOR",
    baseRole:     "EMPLOYEE",
    departmentCode:"TECH_CS",
    baseSalary:   32_000,
  },
  {
    employeeId:   "MAIN-2026-00016",
    fullName:     "Tesfaye Berhe",
    email:        "tesfaye.berhe@bdu.edu.et",
    campusCode:   MAIN_CAMPUS_CODE,
    gender:       "MALE",
    dateOfBirth:  "1993-11-25",
    nationality:  "Ethiopian",
    hireDate:     "2022-09-01",
    status:       "ACTIVE",
    baseRole:     "EMPLOYEE",
    departmentCode:"MAIN_MGMT",
    baseSalary:   10_000,
  },
];

// ─── Main seeder ──────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🌱  HRMS Demo Data Seeder`);
  console.log(`   Default password: ${DEMO_PASSWORD}\n`);

  const pwHash = await hashPw(DEMO_PASSWORD);

  // ── 1. Campuses ─────────────────────────────────────────────────────────────
  console.log("📌  Upserting campuses…");

  const mainCampus = await prisma.campus.upsert({
    where:  { code: MAIN_CAMPUS_CODE },
    update: { name: MAIN_CAMPUS_NAME, updatedAt: now },
    create: { id: id(), code: MAIN_CAMPUS_CODE, name: MAIN_CAMPUS_NAME, updatedAt: now },
  });

  const techCampus = await prisma.campus.upsert({
    where:  { code: TECH_CAMPUS_CODE },
    update: { name: TECH_CAMPUS_NAME, updatedAt: now },
    create: { id: id(), code: TECH_CAMPUS_CODE, name: TECH_CAMPUS_NAME, updatedAt: now },
  });

  const campusMap: Record<string, { id: string }> = {
    [MAIN_CAMPUS_CODE]: mainCampus,
    [TECH_CAMPUS_CODE]: techCampus,
  };
  console.log(`   ✓ MAIN: ${mainCampus.id}`);
  console.log(`   ✓ TECH: ${techCampus.id}`);

  // ── 2. Colleges ─────────────────────────────────────────────────────────────
  console.log("\n🏛️   Upserting colleges…");

  let mainCollege = await prisma.college.findFirst({
    where: { campusId: mainCampus.id, name: "College of Business & Economics" },
  });
  if (!mainCollege) {
    mainCollege = await prisma.college.create({
      data: { id: id(), name: "College of Business & Economics", campusId: mainCampus.id },
    });
  }

  let techCollege = await prisma.college.findFirst({
    where: { campusId: techCampus.id, name: "College of Engineering & Technology" },
  });
  if (!techCollege) {
    techCollege = await prisma.college.create({
      data: { id: id(), name: "College of Engineering & Technology", campusId: techCampus.id },
    });
  }
  console.log(`   ✓ ${mainCollege.name}`);
  console.log(`   ✓ ${techCollege.name}`);

  // ── 3. Departments ───────────────────────────────────────────────────────────
  console.log("\n📂  Upserting departments…");

  let mainMgmtDept = await prisma.department.findFirst({
    where: { collegeId: mainCollege.id, name: "Department of Management" },
  });
  if (!mainMgmtDept) {
    mainMgmtDept = await prisma.department.create({
      data: { id: id(), name: "Department of Management", collegeId: mainCollege.id },
    });
  }

  let techCsDept = await prisma.department.findFirst({
    where: { collegeId: techCollege.id, name: "Department of Computer Science" },
  });
  if (!techCsDept) {
    techCsDept = await prisma.department.create({
      data: { id: id(), name: "Department of Computer Science", collegeId: techCollege.id },
    });
  }

  const deptMap: Record<string, { id: string }> = {
    MAIN_MGMT: mainMgmtDept,
    TECH_CS:   techCsDept,
  };
  console.log(`   ✓ ${mainMgmtDept.name}`);
  console.log(`   ✓ ${techCsDept.name}`);

  // ── 4. EmployeeIDCounters ────────────────────────────────────────────────────
  console.log("\n🔢  Upserting ID counters…");
  const year = 2026;

  await prisma.employeeIDCounter.upsert({
    where:  { campusId_year: { campusId: mainCampus.id, year } },
    update: { sequence: 16 },   // highest MAIN demo sequence
    create: { id: id(), campusId: mainCampus.id, year, sequence: 16 },
  });
  await prisma.employeeIDCounter.upsert({
    where:  { campusId_year: { campusId: techCampus.id, year } },
    update: { sequence: 4 },    // highest TECH demo sequence
    create: { id: id(), campusId: techCampus.id, year, sequence: 4 },
  });
  console.log(`   ✓ MAIN-${year} counter → 16`);
  console.log(`   ✓ TECH-${year} counter → 4`);

  // ── 5. Employees + UserRoles + Salaries ──────────────────────────────────────
  console.log("\n👥  Creating demo employees…\n");

  let created = 0; let skipped = 0;

  for (const u of DEMO_USERS) {
    const campus = campusMap[u.campusCode];
    const dept   = u.departmentCode ? deptMap[u.departmentCode] : undefined;

    // Check if already exists
    const existing = await prisma.employee.findUnique({
      where: { employeeId: u.employeeId },
    });

    let emp: any;
    if (existing) {
      emp = existing;
      skipped++;
      console.log(`   ⏭  ${u.employeeId.padEnd(20)} ${u.fullName} (already exists)`);
    } else {
      emp = await prisma.employee.create({
        data: {
          id:               id(),
          employeeId:       u.employeeId,
          fullName:         u.fullName,
          email:            u.email,
          gender:           u.gender,
          dateOfBirth:      new Date(u.dateOfBirth),
          nationality:      u.nationality,
          hireDate:         new Date(u.hireDate),
          status:           u.status,
          academicRank:     u.academicRank ?? null,
          campusId:         campus.id,
          departmentId:     dept?.id ?? null,
          passwordHash:     pwHash,
          isTempPassword:   true,
          contactInfo:      { phone: "+251911000000", email: u.email },
          emergencyContact: { name: "Emergency Contact", phone: "+251922000000", relation: "Spouse" },
          updatedAt:        now,
        },
      });
      created++;
      console.log(
        `   ✓  ${u.employeeId.padEnd(20)} ${u.fullName.padEnd(28)}` +
        ` ${u.baseRole.padEnd(12)}` +
        (u.specialPrivilege ? ` +${u.specialPrivilege}` : "")
      );
    }

    // UserRole — upsert
    await prisma.userRole.upsert({
      where:  { employeeId: emp.id },
      update: { baseRole: u.baseRole, specialPrivilege: u.specialPrivilege ?? null, updatedAt: now },
      create: {
        id:               id(),
        employeeId:       emp.id,
        baseRole:         u.baseRole,
        specialPrivilege: u.specialPrivilege ?? null,
        updatedAt:        now,
      },
    });

    // EmployeeSalary — only create if missing
    const hasSalary = await prisma.employeeSalary.findFirst({
      where: { employeeId: emp.id },
    });
    if (!hasSalary) {
      await prisma.employeeSalary.create({
        data: {
          id:            id(),
          employeeId:    emp.id,
          baseSalary:    u.baseSalary,
          bonus:         0,
          penalty:       0,
          effectiveFrom: new Date(u.hireDate),
        },
      });
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log(`\n✅  Done.`);
  console.log(`   Created: ${created}  |  Already existed: ${skipped}`);
  console.log(`\n${"─".repeat(70)}`);
  console.log("DEMO LOGIN CREDENTIALS");
  console.log("─".repeat(70));
  console.log(`${"Employee ID".padEnd(22)} ${"Name".padEnd(28)} ${"Role".padEnd(14)} Password`);
  console.log("─".repeat(70));
  for (const u of DEMO_USERS) {
    console.log(
      `${u.employeeId.padEnd(22)} ${u.fullName.padEnd(28)} ${u.baseRole.padEnd(14)} ${DEMO_PASSWORD}`
    );
  }
  console.log("─".repeat(70));
}

main()
  .catch((e) => { console.error("Seeder error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
