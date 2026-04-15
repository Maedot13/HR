/**
 * Property 15: Onboarding Completion Requires All Documents and Assets
 * Validates: Requirements 7.3, 7.4
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import { AppError } from "../middleware/errorHandler.js";
// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockPrisma = vi.hoisted(() => ({
    onboardingWorkflow: { findUnique: vi.fn(), update: vi.fn() },
    onboardingDocument: { update: vi.fn() },
    assetAssignment: { update: vi.fn() },
    employee: { create: vi.fn() },
    employeeIDCounter: { upsert: vi.fn() },
    campus: { findUniqueOrThrow: vi.fn() },
    activityLog: { create: vi.fn() },
    $transaction: vi.fn(),
}));
vi.mock("../lib/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../middleware/activityLogger.js", () => ({ logActivity: vi.fn() }));
import { completeOnboarding } from "./onboarding.service.js";
const actor = {
    userId: "actor-1",
    role: "HR_OFFICER",
    campusId: "campus-1",
    ipAddress: "127.0.0.1",
};
// ── Arbitraries ───────────────────────────────────────────────────────────────
const docArb = (isCollected) => fc.record({
    id: fc.uuid(),
    onboardingWorkflowId: fc.uuid(),
    documentType: fc.constantFrom("ID_CARD", "CONTRACT", "DEGREE_CERT", "PHOTO"),
    isCollected: fc.constant(isCollected),
    collectedAt: isCollected ? fc.date().map((d) => d) : fc.constant(null),
});
const assetArb = (isAssigned) => fc.record({
    id: fc.uuid(),
    onboardingWorkflowId: fc.uuid(),
    assetName: fc.constantFrom("LAPTOP", "ID_BADGE", "OFFICE_KEY", "PARKING_PASS"),
    isAssigned: fc.constant(isAssigned),
    assignedAt: isAssigned ? fc.date().map((d) => d) : fc.constant(null),
});
function buildWorkflow(docs, assets) {
    return {
        id: "workflow-1",
        applicationId: "app-1",
        status: "PENDING",
        createdAt: new Date(),
        documents: docs,
        assetAssignments: assets,
    };
}
// ── Tests ─────────────────────────────────────────────────────────────────────
describe("Property 15: Onboarding Completion Requires All Documents and Assets", () => {
    beforeEach(() => vi.clearAllMocks());
    it("throws ONBOARDING_INCOMPLETE and lists missing items when any doc or asset is incomplete", async () => {
        await fc.assert(fc.asyncProperty(
        // At least one uncollected doc OR one unassigned asset
        fc.oneof(
        // Case A: at least one uncollected doc (assets may be all assigned)
        fc.tuple(fc.array(docArb(true), { minLength: 0, maxLength: 3 }), fc.array(docArb(false), { minLength: 1, maxLength: 3 }), fc.array(assetArb(true), { minLength: 0, maxLength: 3 })).map(([collectedDocs, uncollectedDocs, assignedAssets]) => ({
            docs: [...collectedDocs, ...uncollectedDocs],
            assets: assignedAssets,
        })), 
        // Case B: at least one unassigned asset (docs may be all collected)
        fc.tuple(fc.array(docArb(true), { minLength: 0, maxLength: 3 }), fc.array(assetArb(true), { minLength: 0, maxLength: 3 }), fc.array(assetArb(false), { minLength: 1, maxLength: 3 })).map(([collectedDocs, assignedAssets, unassignedAssets]) => ({
            docs: collectedDocs,
            assets: [...assignedAssets, ...unassignedAssets],
        }))), async ({ docs, assets }) => {
            const workflow = buildWorkflow(docs, assets);
            mockPrisma.onboardingWorkflow.findUnique.mockResolvedValueOnce(workflow);
            let err;
            try {
                await completeOnboarding("workflow-1", actor);
            }
            catch (e) {
                err = e;
            }
            expect(err).toBeInstanceOf(AppError);
            const appErr = err;
            expect(appErr.code).toBe("ONBOARDING_INCOMPLETE");
            expect(appErr.statusCode).toBe(422);
            const details = appErr.details;
            // Missing documents must exactly match uncollected doc types
            const expectedMissingDocs = docs
                .filter((d) => !d.isCollected)
                .map((d) => d.documentType);
            expect(details.missingDocuments).toEqual(expectedMissingDocs);
            // Missing assets must exactly match unassigned asset names
            const expectedMissingAssets = assets
                .filter((a) => !a.isAssigned)
                .map((a) => a.assetName);
            expect(details.missingAssets).toEqual(expectedMissingAssets);
            // Employee must NOT have been created
            expect(mockPrisma.employee.create).not.toHaveBeenCalled();
        }), { numRuns: 100 });
    });
    it("succeeds and creates employee when all documents collected and all assets assigned", async () => {
        await fc.assert(fc.asyncProperty(fc.tuple(fc.array(docArb(true), { minLength: 0, maxLength: 5 }), fc.array(assetArb(true), { minLength: 0, maxLength: 5 })), async ([docs, assets]) => {
            vi.clearAllMocks();
            const workflow = buildWorkflow(docs, assets);
            mockPrisma.onboardingWorkflow.findUnique.mockResolvedValueOnce(workflow);
            mockPrisma.$transaction.mockImplementationOnce(async (fn) => fn({ ...mockPrisma, employeeIDCounter: { upsert: vi.fn().mockResolvedValueOnce({ sequence: 1 }) } }));
            mockPrisma.campus.findUniqueOrThrow.mockResolvedValueOnce({ code: "BDU" });
            mockPrisma.employee.create.mockResolvedValueOnce({ id: "emp-1" });
            mockPrisma.onboardingWorkflow.update.mockResolvedValueOnce({
                ...workflow,
                status: "COMPLETED",
            });
            const result = await completeOnboarding("workflow-1", actor);
            expect(result.status).toBe("COMPLETED");
            expect(mockPrisma.employee.create).toHaveBeenCalledOnce();
            expect(mockPrisma.onboardingWorkflow.update).toHaveBeenCalledWith({
                where: { id: "workflow-1" },
                data: { status: "COMPLETED" },
            });
        }), { numRuns: 100 });
    });
});
//# sourceMappingURL=onboarding.property.test.js.map