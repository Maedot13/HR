/**
 * Property 6: Employee ID Uniqueness & Format
 *
 * For N concurrent employee creations under the same campus/year, all generated
 * IDs are distinct and the sequence increments by exactly 1 each time.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";

// ── Mock prisma ───────────────────────────────────────────────────────────────
const counterStore: Map<string, number> = new Map();
const campusStore: Map<string, { code: string }> = new Map();

const mockTx = {
  employeeIDCounter: {
    upsert: vi.fn(async ({ where, create }: any) => {
      const key = `${where.campusId_year.campusId}:${where.campusId_year.year}`;
      if (counterStore.has(key)) {
        const next = counterStore.get(key)! + 1;
        counterStore.set(key, next);
        return { sequence: next };
      } else {
        counterStore.set(key, create.sequence);
        return { sequence: create.sequence };
      }
    }),
  },
};

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    $transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => fn(mockTx)),
    campus: {
      findUniqueOrThrow: vi.fn(async ({ where }: any) => {
        const campus = campusStore.get(where.id);
        if (!campus) throw new Error(`Campus not found: ${where.id}`);
        return campus;
      }),
    },
  },
}));

import { generate } from "./employeeId.service.js";

const ID_FORMAT = /^[A-Z0-9]+-\d{4}-\d{5}$/;

beforeEach(() => {
  counterStore.clear();
  campusStore.clear();
  vi.clearAllMocks();
});

describe("Property 6: Employee ID Uniqueness & Format (Requirements 4.1–4.4)", () => {
  it("4.1 – generated IDs match [CampusCode]-[Year]-[NNNNN] format", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 2, maxLength: 6 }).map((s) =>
          s.toUpperCase().replace(/[^A-Z0-9]/g, "A")
        ),
        fc.integer({ min: 2000, max: 2100 }),
        async (code, year) => {
          const campusId = `campus-${code}`;
          campusStore.set(campusId, { code });
          const id = await generate(campusId, year);
          expect(id).toMatch(ID_FORMAT);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("4.2 & 4.4 – N sequential IDs for the same campus/year are all distinct", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 20 }),
        async (n) => {
          counterStore.clear();
          const campusId = "campus-BDU";
          campusStore.set(campusId, { code: "BDU" });
          const year = 2026;
          const ids: string[] = [];
          for (let i = 0; i < n; i++) {
            ids.push(await generate(campusId, year));
          }
          expect(new Set(ids).size).toBe(n);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("4.2 – sequence increments by exactly 1 for each call", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 15 }),
        async (n) => {
          counterStore.clear();
          const campusId = "campus-BDU";
          campusStore.set(campusId, { code: "BDU" });
          const year = 2026;
          const ids: string[] = [];
          for (let i = 0; i < n; i++) {
            ids.push(await generate(campusId, year));
          }
          const sequences = ids.map((id) => parseInt(id.split("-")[2], 10));
          for (let i = 0; i < n; i++) {
            expect(sequences[i]).toBe(i + 1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("4.3 – year reset: new year starts sequence at 1, independent of previous year", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2000, max: 2099 }),
        fc.integer({ min: 1, max: 10 }),
        async (year, prevCount) => {
          counterStore.clear();
          const campusId = "campus-BDU";
          campusStore.set(campusId, { code: "BDU" });
          for (let i = 0; i < prevCount; i++) {
            await generate(campusId, year);
          }
          const nextYearId = await generate(campusId, year + 1);
          const seq = parseInt(nextYearId.split("-")[2], 10);
          expect(seq).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});
