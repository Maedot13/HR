import { PrismaClient, LeaveTypeName, BaseRole } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Leave Type seed data ─────────────────────────────────────────────────────

const leaveTypes: Array<{
  name: LeaveTypeName;
  description: string;
  maxDays: number | null;
  payRate: number;
}> = [
  {
    name: LeaveTypeName.ANNUAL,
    description: 'Annual leave entitlement (20 days first year, +1/year up to 30)',
    maxDays: 30,
    payRate: 1.0,
  },
  {
    name: LeaveTypeName.MATERNITY_PRENATAL,
    description: 'Maternity leave — prenatal period (30 calendar days at full pay)',
    maxDays: 30,
    payRate: 1.0,
  },
  {
    name: LeaveTypeName.MATERNITY_POSTNATAL,
    description: 'Maternity leave — postnatal period (90 calendar days at full pay)',
    maxDays: 90,
    payRate: 1.0,
  },
  {
    name: LeaveTypeName.PATERNITY,
    description: 'Paternity leave (10 working days at full pay)',
    maxDays: 10,
    payRate: 1.0,
  },
  {
    name: LeaveTypeName.SICK_FULL,
    description: 'Sick leave at full pay (up to 6 months within a 12-month period)',
    maxDays: 180,
    payRate: 1.0,
  },
  {
    name: LeaveTypeName.SICK_HALF,
    description: 'Sick leave at half pay (up to 2 additional months after 6-month full-pay period)',
    maxDays: 60,
    payRate: 0.5,
  },
  {
    name: LeaveTypeName.PERSONAL,
    description: 'Personal leave for marriage or bereavement of immediate family (3 working days)',
    maxDays: 3,
    payRate: 1.0,
  },
  {
    name: LeaveTypeName.SPECIAL,
    description: 'Special leave for court summons or election duty (subject to HR approval)',
    maxDays: null,
    payRate: 1.0,
  },
  {
    name: LeaveTypeName.LEAVE_WITHOUT_PAY,
    description: 'Unpaid leave (max 2 years, requires University President approval)',
    maxDays: 730,
    payRate: 0.0,
  },
  {
    name: LeaveTypeName.STUDY,
    description: 'Study leave for academic staff pursuing higher degree (full pay year 1, 50% thereafter)',
    maxDays: null,
    payRate: 1.0,
  },
  {
    name: LeaveTypeName.RESEARCH,
    description: 'Research leave for Assistant Professor+ with 3+ years service (up to 6 months at full pay)',
    maxDays: 180,
    payRate: 1.0,
  },
  {
    name: LeaveTypeName.SABBATICAL,
    description: 'Sabbatical leave for Assistant Professor+ with 6+ continuous years (1 year at full pay)',
    maxDays: 365,
    payRate: 1.0,
  },
  {
    name: LeaveTypeName.SEMINAR,
    description: 'Leave for seminars, workshops, or short courses (max 30 academic calendar days/year)',
    maxDays: 30,
    payRate: 1.0,
  },
];

// ─── Permission seed data ─────────────────────────────────────────────────────

const permissions: Array<{ code: string; description: string }> = [
  // Campus / Org hierarchy
  { code: 'campus:create', description: 'Create a campus' },
  { code: 'campus:read', description: 'Read campus data' },
  { code: 'campus:update', description: 'Update a campus' },
  { code: 'campus:delete', description: 'Delete a campus' },
  { code: 'college:create', description: 'Create a college' },
  { code: 'college:read', description: 'Read college data' },
  { code: 'college:update', description: 'Update a college' },
  { code: 'college:delete', description: 'Delete a college' },
  { code: 'department:create', description: 'Create a department' },
  { code: 'department:read', description: 'Read department data' },
  { code: 'department:update', description: 'Update a department' },
  { code: 'department:delete', description: 'Delete a department' },
  { code: 'unit:create', description: 'Create a unit' },
  { code: 'unit:read', description: 'Read unit data' },
  { code: 'unit:update', description: 'Update a unit' },
  { code: 'unit:delete', description: 'Delete a unit' },
  // Employee
  { code: 'employee:create', description: 'Create an employee profile' },
  { code: 'employee:read', description: 'Read employee profiles' },
  { code: 'employee:update', description: 'Update an employee profile' },
  { code: 'employee:activate', description: 'Activate an employee account' },
  { code: 'employee:deactivate', description: 'Deactivate an employee account' },
  { code: 'employee:document:upload', description: 'Upload employee documents' },
  // Roles & privileges
  { code: 'role:assign', description: 'Assign base roles to users' },
  { code: 'privilege:assign', description: 'Assign special privileges to users' },
  // Recruitment
  { code: 'job-posting:create', description: 'Create a job posting' },
  { code: 'job-posting:read', description: 'Read job postings' },
  { code: 'job-posting:update', description: 'Update a job posting' },
  { code: 'application:submit', description: 'Submit a job application' },
  { code: 'application:advance', description: 'Advance an application stage' },
  { code: 'application:offer', description: 'Issue an offer to an applicant' },
  // Onboarding
  { code: 'onboarding:read', description: 'Read onboarding workflows' },
  { code: 'onboarding:update', description: 'Update onboarding workflow items' },
  { code: 'onboarding:complete', description: 'Complete onboarding and register employee' },
  // Timetable
  { code: 'schedule:create', description: 'Create schedule entries' },
  { code: 'schedule:read', description: 'Read schedule entries' },
  { code: 'schedule:update', description: 'Update schedule entries' },
  { code: 'schedule:delete', description: 'Delete schedule entries' },
  { code: 'substitution:create', description: 'Record a substitution' },
  // Leave
  { code: 'leave:apply', description: 'Submit a leave application' },
  { code: 'leave:read', description: 'Read leave applications and balances' },
  { code: 'leave:approve', description: 'Approve a leave application' },
  { code: 'leave:reject', description: 'Reject a leave application' },
  // Appraisal
  { code: 'evaluation:create', description: 'Create a performance evaluation' },
  { code: 'evaluation:read', description: 'Read performance evaluations' },
  { code: 'evaluation:update', description: 'Update a performance evaluation' },
  // Training
  { code: 'training:create', description: 'Create a training program' },
  { code: 'training:read', description: 'Read training programs and assignments' },
  { code: 'training:assign', description: 'Assign training to an employee' },
  { code: 'training:complete', description: 'Mark training as completed' },
  // Payroll
  { code: 'payroll:generate', description: 'Generate a payroll report' },
  { code: 'payroll:read', description: 'Read payroll reports' },
  { code: 'payroll:export', description: 'Export payroll reports' },
  { code: 'payroll:validate', description: 'Validate a payroll report (Finance Actor)' },
  // Clearance
  { code: 'clearance:configure', description: 'Configure clearance bodies' },
  { code: 'clearance:initiate', description: 'Initiate a clearance process' },
  { code: 'clearance:read', description: 'Read clearance records and tasks' },
  { code: 'clearance:approve', description: 'Approve a clearance task' },
  { code: 'clearance:reject', description: 'Reject a clearance task' },
  // Experience letters
  { code: 'experience-letter:generate', description: 'Generate an experience letter' },
  { code: 'experience-letter:read', description: 'Read generated experience letters' },
  // Activity log
  { code: 'activity-log:read', description: 'Read the activity log' },
];

// ─── Role → Permission mappings ───────────────────────────────────────────────

const rolePermissions: Record<BaseRole, string[]> = {
  [BaseRole.SUPER_ADMIN]: permissions.map((p) => p.code), // all permissions
  [BaseRole.ADMIN]: [
    'campus:read',
    'college:create', 'college:read', 'college:update', 'college:delete',
    'department:create', 'department:read', 'department:update', 'department:delete',
    'unit:create', 'unit:read', 'unit:update', 'unit:delete',
    'employee:create', 'employee:read', 'employee:update', 'employee:activate',
    'employee:deactivate', 'employee:document:upload',
    'role:assign', 'privilege:assign',
    'job-posting:create', 'job-posting:read', 'job-posting:update',
    'application:submit', 'application:advance', 'application:offer',
    'onboarding:read', 'onboarding:update', 'onboarding:complete',
    'schedule:create', 'schedule:read', 'schedule:update', 'schedule:delete',
    'substitution:create',
    'leave:read', 'leave:approve', 'leave:reject',
    'evaluation:create', 'evaluation:read', 'evaluation:update',
    'training:create', 'training:read', 'training:assign', 'training:complete',
    'payroll:generate', 'payroll:read', 'payroll:export', 'payroll:validate',
    'clearance:configure', 'clearance:initiate', 'clearance:read',
    'clearance:approve', 'clearance:reject',
    'experience-letter:generate', 'experience-letter:read',
    'activity-log:read',
  ],
  [BaseRole.HR_OFFICER]: [
    'campus:read',
    'college:read', 'department:read', 'unit:read',
    'employee:create', 'employee:read', 'employee:update', 'employee:activate',
    'employee:document:upload',
    'job-posting:create', 'job-posting:read', 'job-posting:update',
    'application:submit', 'application:advance', 'application:offer',
    'onboarding:read', 'onboarding:update', 'onboarding:complete',
    'schedule:read',
    'leave:read', 'leave:approve', 'leave:reject',
    'evaluation:create', 'evaluation:read', 'evaluation:update',
    'training:create', 'training:read', 'training:assign', 'training:complete',
    'payroll:generate', 'payroll:read', 'payroll:export',
    'clearance:initiate', 'clearance:read', 'clearance:approve', 'clearance:reject',
    'experience-letter:generate', 'experience-letter:read',
    'activity-log:read',
  ],
  [BaseRole.EMPLOYEE]: [
    'campus:read',
    'college:read', 'department:read', 'unit:read',
    'employee:read',
    'schedule:read',
    'leave:apply', 'leave:read',
    'evaluation:read',
    'training:read',
    'experience-letter:read',
  ],
};

// ─── Main seed function ───────────────────────────────────────────────────────

async function main() {
  console.log('Seeding leave types...');
  for (const lt of leaveTypes) {
    await prisma.leaveType.upsert({
      where: { name: lt.name },
      update: {
        description: lt.description,
        maxDays: lt.maxDays,
        payRate: lt.payRate,
      },
      create: lt,
    });
  }
  console.log(`  ✓ ${leaveTypes.length} leave types seeded`);

  console.log('Seeding permissions...');
  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: { description: perm.description },
      create: perm,
    });
  }
  console.log(`  ✓ ${permissions.length} permissions seeded`);

  console.log('Seeding role permissions...');
  let rpCount = 0;
  for (const [role, codes] of Object.entries(rolePermissions) as [BaseRole, string[]][]) {
    for (const code of codes) {
      const permission = await prisma.permission.findUnique({ where: { code } });
      if (!permission) {
        console.warn(`  ⚠ Permission not found: ${code}`);
        continue;
      }
      await prisma.rolePermission.upsert({
        where: { role_permissionId: { role, permissionId: permission.id } },
        update: {},
        create: { role, permissionId: permission.id },
      });
      rpCount++;
    }
  }
  console.log(`  ✓ ${rpCount} role-permission mappings seeded`);

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
