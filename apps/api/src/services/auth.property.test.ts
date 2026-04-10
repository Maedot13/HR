/**
 * Property 8: Password Storage as Bcrypt Hash
 *
 * Generate arbitrary password strings; assert stored value matches
 * `$2b$12$...` pattern and `bcrypt.compare` returns true.
 *
 * Validates: Requirements 5.3
 */

import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import bcrypt from "bcrypt";

// Mock prisma so the module can be imported without a real DB connection
vi.mock("../lib/prisma.js", () => ({
  prisma: {},
}));

// Mock activityLogger to avoid prisma dependency
vi.mock("../middleware/activityLogger.js", () => ({
  logActivity: vi.fn(),
}));

import { hashPassword } from "./auth.service.js";

describe("Property 8: Password Storage as Bcrypt Hash", () => {
  it(
    "should store passwords as bcrypt hashes with cost factor 12 that verify correctly",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary printable ASCII password strings, length 8–72
          fc
            .string({ minLength: 8, maxLength: 72 })
            .filter((s) =>
              s.split("").every(
                (c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126
              )
            ),
          async (password) => {
            const hash = await hashPassword(password);

            // Assert the hash matches the $2b$12$ bcrypt pattern
            expect(hash).toMatch(/^\$2b\$12\$/);

            // Assert bcrypt.compare returns true for the original password
            const isValid = await bcrypt.compare(password, hash);
            expect(isValid).toBe(true);

            // Assert bcrypt.compare returns false for a different password
            const isInvalid = await bcrypt.compare(password + "_wrong", hash);
            expect(isInvalid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    },
    // bcrypt cost 12 ≈ 100–200ms per hash × 100 runs × 2 compares = ~30–60s
    120_000
  );
});
