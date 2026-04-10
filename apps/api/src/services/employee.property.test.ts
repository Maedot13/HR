/**
 * Property tests for Employee Service
 *
 * Property 20: Employee Profile Activation Requires Complete Mandatory Fields
 *   Generate employee profiles with one or more mandatory fields set to null;
 *   assert activation is rejected and the response lists exactly the missing fields.
 *   Also test: when all mandatory fields are present, activation succeeds.
 *   Validates: Requirements 2.5, 2.6
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import { AppError } from "../middleware/errorHandler.js";

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({
  employee: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  userRole: {
    create: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  employeeDocument: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  employmentHistory: {
    create: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn(),
  },
  activityLog: {
    create: vi.fn(),
  },
}));

vi.mock("../lib/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../middleware/activityLogger.js", () => ({ logActivity: vi.fn() }));
vi.mock("./auth.service.js", () => ({
  hashPassword: vi.fn().mockResolvedValue("$2b$12$hashedpassword"),
}));
vi.mock("./employeeId.service.js", () => ({
  generate: vi.fn().mockResolvedValue("BDU-2026-00001"),
}));

import { activateEmployee } from "./employee.service.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const actor = {
  userId: "actor-user-id",
  role: "HR_OFFICER",
  campusId: "campus-1",
  ipAddress: "127.0.0.1",
};

const MANDATORY_FIELDS = [
  "fullName",
  "dateOfBirth",
  "gender",
  "nationality",
  "contactInfo",
  "emergencyContact",
] as const;

type MandatoryField = (typeof MANDATORY_FIELDS)[number];

/** Build a complete employee record with all mandatory fields populated */
function buildCompleteEmployee(id: string) {
  return {
    id,
    employeeId: "BDU-2026-00001",
    fullName: "Abebe Kebede",
    dateOfBirth: new Date("1985-06-15"),
    gender: "MALE",
    nationality: "Ethiopian",
    contactInfo: { phone: "+251911000000", email: "abebe@bdu.edu.et", address: "Bahir Dar" },
    emergencyContact: { name: "Tigist Kebede", phone: "+251922000000", relationship: "Spouse" },
    academicRank: null,
    status: "PENDING",
    campusId: "campus-1",
    departmentId: null,
    unitId: null,
    hireDate: null,
    endDate: null,
    passwordHash: "$2b$12$hash",
    isTempPassword: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ─── Property 20: Activation Requires Complete Mandatory Fields ───────────────

describe("Property 20: Employee Profile Activation Requires Complete Mandatory Fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Validates: Requirements 2.5, 2.6**
   *
   * When one or more mandatory fields are null/empty, activation must be rejected
   * with INCOMPLETE_PROFILE and the response must list exactly the missing fields.
   */
  it(
    "activation is rejected with INCOMPLETE_PROFILE when any mandatory field is null, listing exactly the missing fields",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a non-empty subset of mandatory fields to set to null
          fc
            .subarray(MANDATORY_FIELDS as unknown as MandatoryField[], {
              minLength: 1,
            })
            .map((fields) => fields as MandatoryField[]),
          async (nullFields) => {
            const id = "employee-test-id";
            const base = buildCompleteEmployee(id);

            // Set the chosen fields to null
            const employee = { ...base } as Record<string, unknown>;
            for (const field of nullFields) {
              employee[field] = null;
            }

            mockPrisma.employee.findUnique.mockResolvedValueOnce(employee);

            let caughtError: unknown;
            try {
              await activateEmployee(id, actor);
            } catch (err) {
              caughtError = err;
            }

            // Must throw an AppError
            expect(caughtError).toBeInstanceOf(AppError);
            const appErr = caughtError as AppError;

            // Status code must be 422
            expect(appErr.statusCode).toBe(422);

            // Error code must be INCOMPLETE_PROFILE
            expect(appErr.code).toBe("INCOMPLETE_PROFILE");

            // Details must contain missingFields
            const details = appErr.details as { missingFields: string[] };
            expect(details).toBeDefined();
            expect(Array.isArray(details.missingFields)).toBe(true);

            // The missing fields list must contain exactly the nulled fields (no more, no fewer)
            const reported = new Set(details.missingFields);
            const expected = new Set(nullFields);
            expect(reported).toEqual(expected);

            // Employee must NOT have been updated
            expect(mockPrisma.employee.update).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 200 }
      );
    }
  );

  /**
   * **Validates: Requirements 2.5, 2.6**
   *
   * When all mandatory fields are present and non-empty, activation must succeed
   * and set status to ACTIVE.
   */
  it(
    "activation succeeds and sets status to ACTIVE when all mandatory fields are present",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (id) => {
            const employee = buildCompleteEmployee(id);
            const activated = { ...employee, status: "ACTIVE" };

            mockPrisma.employee.findUnique.mockResolvedValueOnce(employee);
            mockPrisma.employee.update.mockResolvedValueOnce(activated);
            mockPrisma.employmentHistory.create.mockResolvedValueOnce({});

            const result = await activateEmployee(id, actor);

            // Must succeed and return ACTIVE status
            expect(result.status).toBe("ACTIVE");

            // Prisma update must have been called with status ACTIVE
            expect(mockPrisma.employee.update).toHaveBeenCalledWith({
              where: { id },
              data: { status: "ACTIVE" },
            });
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  /**
   * **Validates: Requirements 2.5, 2.6**
   *
   * The missing fields list must never include fields that are actually present.
   * (No false positives in the missing fields report.)
   */
  it(
    "missing fields list never includes fields that are present",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc
            .subarray(MANDATORY_FIELDS as unknown as MandatoryField[], {
              minLength: 1,
              maxLength: MANDATORY_FIELDS.length - 1,
            })
            .map((fields) => fields as MandatoryField[]),
          async (nullFields) => {
            const id = "employee-test-id-2";
            const base = buildCompleteEmployee(id);
            const employee = { ...base } as Record<string, unknown>;

            for (const field of nullFields) {
              employee[field] = null;
            }

            mockPrisma.employee.findUnique.mockResolvedValueOnce(employee);

            let caughtError: unknown;
            try {
              await activateEmployee(id, actor);
            } catch (err) {
              caughtError = err;
            }

            expect(caughtError).toBeInstanceOf(AppError);
            const appErr = caughtError as AppError;
            const details = appErr.details as { missingFields: string[] };

            const presentFields = MANDATORY_FIELDS.filter(
              (f) => !nullFields.includes(f)
            );

            // None of the present fields should appear in missingFields
            for (const presentField of presentFields) {
              expect(details.missingFields).not.toContain(presentField);
            }
          }
        ),
        { numRuns: 150 }
      );
    }
  );
});
