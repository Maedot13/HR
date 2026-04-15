/**
 * Property 9: Recruitment Stage Ordering
 * Validates: Requirements 6.4, 6.5, 6.6
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";
import { AppError } from "../middleware/errorHandler.js";
import { STAGE_ORDER } from "./recruitment.service.js";
const mockPrisma = vi.hoisted(() => ({
    application: { findUnique: vi.fn(), update: vi.fn() },
    applicationStage: { create: vi.fn() },
    onboardingWorkflow: { create: vi.fn() },
    activityLog: { create: vi.fn() },
}));
vi.mock("../lib/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../middleware/activityLogger.js", () => ({ logActivity: vi.fn() }));
import { advanceStage } from "./recruitment.service.js";
const actor = { userId: "actor-1", role: "HR_OFFICER", ipAddress: "127.0.0.1" };
function buildApp(id, currentStage, isAcademic = false, score = null) {
    return {
        id,
        jobPostingId: "posting-1",
        jobPosting: { id: "posting-1", isAcademic },
        candidateName: "Test",
        candidateEmail: "test@example.com",
        submittedAt: new Date(),
        currentStage,
        publicationEvalScore: score,
        stageHistory: [],
    };
}
describe("Property 9: Recruitment Stage Ordering", () => {
    beforeEach(() => vi.clearAllMocks());
    it("valid forward transitions succeed for all non-final stages", async () => {
        await fc.assert(fc.asyncProperty(fc.integer({ min: 0, max: STAGE_ORDER.length - 2 }), async (idx) => {
            const current = STAGE_ORDER[idx];
            const next = STAGE_ORDER[idx + 1];
            const app = buildApp("app-1", current, false, null);
            mockPrisma.application.findUnique.mockResolvedValueOnce(app);
            mockPrisma.application.update.mockResolvedValueOnce({ ...app, currentStage: next });
            mockPrisma.applicationStage.create.mockResolvedValueOnce({});
            mockPrisma.onboardingWorkflow.create.mockResolvedValueOnce({});
            const result = await advanceStage("app-1", {}, actor);
            return result.currentStage === next;
        }), { numRuns: 100 });
    });
    it("advancing from OFFER (final stage) throws INVALID_STAGE_TRANSITION", async () => {
        await fc.assert(fc.asyncProperty(fc.constant("OFFER"), async (stage) => {
            mockPrisma.application.findUnique.mockResolvedValueOnce(buildApp("app-final", stage));
            let err;
            try {
                await advanceStage("app-final", {}, actor);
            }
            catch (e) {
                err = e;
            }
            expect(err).toBeInstanceOf(AppError);
            expect(err.code).toBe("INVALID_STAGE_TRANSITION");
        }), { numRuns: 10 });
    });
    it("academic role without publicationEvalScore is rejected at SCREENING with ACADEMIC_SCORE_REQUIRED", async () => {
        await fc.assert(fc.asyncProperty(fc.uuid(), async (appId) => {
            mockPrisma.application.findUnique.mockResolvedValueOnce(buildApp(appId, "SCREENING", true, null));
            let err;
            try {
                await advanceStage(appId, {}, actor);
            }
            catch (e) {
                err = e;
            }
            expect(err).toBeInstanceOf(AppError);
            expect(err.code).toBe("ACADEMIC_SCORE_REQUIRED");
            expect(mockPrisma.application.update).not.toHaveBeenCalled();
        }), { numRuns: 100 });
    });
    it("academic role WITH publicationEvalScore advances from SCREENING to INTERVIEW", async () => {
        await fc.assert(fc.asyncProperty(fc.uuid(), fc.float({ min: 0, max: 100, noNaN: true }), async (appId, score) => {
            const app = buildApp(appId, "SCREENING", true, null);
            mockPrisma.application.findUnique.mockResolvedValueOnce(app);
            mockPrisma.application.update.mockResolvedValueOnce({ ...app, currentStage: "INTERVIEW", publicationEvalScore: score });
            mockPrisma.applicationStage.create.mockResolvedValueOnce({});
            const result = await advanceStage(appId, { publicationEvalScore: score }, actor);
            return result.currentStage === "INTERVIEW";
        }), { numRuns: 100 });
    });
});
//# sourceMappingURL=recruitment.property.test.js.map