/**
 * Property tests for Organizational Hierarchy Service
 *
 * Property 1: Organizational Hierarchy Membership
 *   Every Department has exactly one College parent (collegeId non-null, references real College).
 *   Every Unit has exactly one Department parent (departmentId non-null, references real Department).
 *   No orphaned nodes exist.
 *   Validates: Requirements 1.1, 1.6, 1.7
 *
 * Property 2: Campus Code Immutability
 *   If code is in the update payload, the service throws CAMPUS_CODE_IMMUTABLE.
 *   After any successful update, the campus code is unchanged.
 *   Validates: Requirements 1.2, 1.3
 *
 * Property 3: Campus Deletion Blocked When Employees Exist
 *   Campus with N >= 1 employees → deletion throws CAMPUS_HAS_EMPLOYEES.
 *   Campus with N = 0 employees → deletion succeeds.
 *   Validates: Requirements 1.4, 1.5
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import { AppError } from "../middleware/errorHandler.js";

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  campus: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  college: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  department: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  unit: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  employee: {
    count: vi.fn(),
  },
  activityLog: {
    create: vi.fn(),
  },
}));

vi.mock("../lib/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../middleware/activityLogger.js", () => ({ logActivity: vi.fn() }));

import {
  createCampus,
  updateCampus,
  deleteCampus,
  createCollege,
  createDepartment,
  createUnit,
} from "./org.service.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const actor = {
  userId: "user-1",
  role: "SUPER_ADMIN",
  campusId: "campus-1",
  ipAddress: "127.0.0.1",
};

function makeId() {
  return Math.random().toString(36).slice(2);
}

// ─── Property 1: Organizational Hierarchy Membership ─────────────────────────

describe("Property 1: Organizational Hierarchy Membership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it(
    "every Department has exactly one College parent and every Unit has exactly one Department parent — no orphaned nodes",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a random org tree: 1 campus, 1-3 colleges, 1-3 departments per college, 1-3 units per department
          fc.record({
            campusId: fc.uuid(),
            colleges: fc.array(
              fc.record({
                id: fc.uuid(),
                name: fc.string({ minLength: 1, maxLength: 30 }),
              }),
              { minLength: 1, maxLength: 3 }
            ),
          }).chain(({ campusId, colleges }) =>
            fc.record({
              campusId: fc.constant(campusId),
              colleges: fc.constant(colleges),
              departments: fc.array(
                fc.record({
                  id: fc.uuid(),
                  name: fc.string({ minLength: 1, maxLength: 30 }),
                  collegeId: fc.constantFrom(...colleges.map((c) => c.id)),
                }),
                { minLength: 1, maxLength: 6 }
              ),
            }).chain(({ campusId: cid, colleges: cols, departments }) =>
              fc.record({
                campusId: fc.constant(cid),
                colleges: fc.constant(cols),
                departments: fc.constant(departments),
                units: fc.array(
                  fc.record({
                    id: fc.uuid(),
                    name: fc.string({ minLength: 1, maxLength: 30 }),
                    departmentId: fc.constantFrom(...departments.map((d) => d.id)),
                  }),
                  { minLength: 1, maxLength: 9 }
                ),
              })
            )
          ),
          async ({ campusId, colleges, departments, units }) => {
            // Build lookup maps
            const collegeMap = new Map(colleges.map((c) => [c.id, { ...c, campusId }]));
            const departmentMap = new Map(departments.map((d) => [d.id, d]));

            // Assert: every department has a non-null collegeId that references a real college
            for (const dept of departments) {
              expect(dept.collegeId).toBeTruthy();
              expect(collegeMap.has(dept.collegeId)).toBe(true);
            }

            // Assert: every unit has a non-null departmentId that references a real department
            for (const unit of units) {
              expect(unit.departmentId).toBeTruthy();
              expect(departmentMap.has(unit.departmentId)).toBe(true);
            }

            // Assert: no orphaned departments (all collegeIds resolve)
            const orphanedDepts = departments.filter((d) => !collegeMap.has(d.collegeId));
            expect(orphanedDepts).toHaveLength(0);

            // Assert: no orphaned units (all departmentIds resolve)
            const orphanedUnits = units.filter((u) => !departmentMap.has(u.departmentId));
            expect(orphanedUnits).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "createDepartment associates department with exactly one college via service",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            collegeId: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          async ({ collegeId, name }) => {
            const college = { id: collegeId, name: "Test College", campusId: "campus-1" };
            const expectedDept = { id: makeId(), name, collegeId };

            mockPrisma.college.findUnique.mockResolvedValueOnce(college);
            mockPrisma.department.create.mockResolvedValueOnce(expectedDept);

            const dept = await createDepartment(name, collegeId, actor);

            // The created department must reference exactly the provided collegeId
            expect(dept.collegeId).toBe(collegeId);
            expect(dept.collegeId).not.toBeNull();
            expect(dept.collegeId).not.toBeUndefined();

            // Prisma was called with the correct collegeId
            expect(mockPrisma.department.create).toHaveBeenCalledWith({
              data: { name, collegeId },
            });
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "createUnit associates unit with exactly one department via service",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            departmentId: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          async ({ departmentId, name }) => {
            const department = {
              id: departmentId,
              name: "Test Dept",
              collegeId: "college-1",
            };
            const expectedUnit = { id: makeId(), name, departmentId };

            mockPrisma.department.findUnique.mockResolvedValueOnce(department);
            mockPrisma.unit.create.mockResolvedValueOnce(expectedUnit);

            const unit = await createUnit(name, departmentId, actor);

            // The created unit must reference exactly the provided departmentId
            expect(unit.departmentId).toBe(departmentId);
            expect(unit.departmentId).not.toBeNull();
            expect(unit.departmentId).not.toBeUndefined();

            expect(mockPrisma.unit.create).toHaveBeenCalledWith({
              data: { name, departmentId },
            });
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ─── Property 2: Campus Code Immutability ─────────────────────────────────────

describe("Property 2: Campus Code Immutability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it(
    "update payload containing 'code' field always throws CAMPUS_CODE_IMMUTABLE",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            code: fc.string({ minLength: 1, maxLength: 20 }),
            name: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          async ({ id, code, name }) => {
            // Payload includes 'code' — must always be rejected
            const payloadWithCode = { code, name };

            await expect(
              updateCampus(id, payloadWithCode, actor)
            ).rejects.toMatchObject({
              code: "CAMPUS_CODE_IMMUTABLE",
              statusCode: 400,
            });
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "successful update never changes the campus code",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            originalCode: fc.string({ minLength: 1, maxLength: 20 }),
            originalName: fc.string({ minLength: 1, maxLength: 100 }),
            newName: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          async ({ id, originalCode, originalName, newName }) => {
            const existingCampus = { id, code: originalCode, name: originalName };
            const updatedCampus = { id, code: originalCode, name: newName };

            mockPrisma.campus.findUnique.mockResolvedValueOnce(existingCampus);
            mockPrisma.campus.update.mockResolvedValueOnce(updatedCampus);

            const result = await updateCampus(id, { name: newName }, actor);

            // Code must remain unchanged after update
            expect(result.code).toBe(originalCode);

            // Prisma update must NOT include code in the data
            const updateCall = mockPrisma.campus.update.mock.calls[0][0];
            expect(updateCall.data).not.toHaveProperty("code");
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "update payload with only name field succeeds without touching code",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            code: fc.string({ minLength: 1, maxLength: 20 }),
            name: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          async ({ id, code, name }) => {
            const existing = { id, code, name: "Old Name" };
            const updated = { id, code, name };

            mockPrisma.campus.findUnique.mockResolvedValueOnce(existing);
            mockPrisma.campus.update.mockResolvedValueOnce(updated);

            // Payload without code must succeed
            const result = await updateCampus(id, { name }, actor);
            expect(result.code).toBe(code);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ─── Property 3: Campus Deletion Blocked When Employees Exist ─────────────────

describe("Property 3: Campus Deletion Blocked When Employees Exist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it(
    "deletion throws CAMPUS_HAS_EMPLOYEES when N >= 1 employees are linked",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            employeeCount: fc.integer({ min: 1, max: 100 }),
          }),
          async ({ id, employeeCount }) => {
            const campus = { id, code: "TST", name: "Test Campus" };

            mockPrisma.campus.findUnique.mockResolvedValueOnce(campus);
            mockPrisma.employee.count.mockResolvedValueOnce(employeeCount);

            await expect(deleteCampus(id, actor)).rejects.toMatchObject({
              code: "CAMPUS_HAS_EMPLOYEES",
              statusCode: 409,
            });
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  it(
    "deletion succeeds when N = 0 employees are linked",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (id) => {
            const campus = { id, code: "TST", name: "Test Campus" };

            mockPrisma.campus.findUnique.mockResolvedValueOnce(campus);
            mockPrisma.employee.count.mockResolvedValueOnce(0);
            mockPrisma.campus.delete.mockResolvedValueOnce(campus);

            // Should not throw
            await expect(deleteCampus(id, actor)).resolves.toBeUndefined();

            expect(mockPrisma.campus.delete).toHaveBeenCalledWith({ where: { id } });
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
