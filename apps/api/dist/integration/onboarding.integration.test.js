/**
 * Integration Test: Full Onboarding Pipeline
 * Validates: Requirements 7.1–7.4
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
const mockPrisma = vi.hoisted(() => ({
    jobPosting: { findUnique: vi.fn() },
    application: { findUnique: vi.fn(), update: vi.fn() },
    applicationStage: { create: vi.fn() },
    onboardingWorkflow: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
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
import { advanceStage } from "../services/recruitment.service.js";
import { markDocumentCollected, markAssetAssigned, completeOnboarding } from "../services/onboarding.service.js";
const actor = { userId: "actor-1", role: "HR_OFFICER", campusId: "campus-1", ipAddress: "127.0.0.1" };
const recruitActor = { userId: "actor-1", role: "HR_OFFICER", ipAddress: "127.0.0.1" };
const APP_ID = "app-1";
const WORKFLOW_ID = "workflow-1";
const DOC_ID = "doc-1";
const ASSET_ID = "asset-1";
function makeApp(stage) {
    return { id: APP_ID, jobPostingId: "posting-1", jobPosting: { id: "posting-1", isAcademic: false }, candidateName: "Jane", candidateEmail: "jane@test.com", currentStage: stage, publicationEvalScore: null, submittedAt: new Date() };
}
function makeWorkflow(docs, assets) {
    return { id: WORKFLOW_ID, applicationId: APP_ID, status: "PENDING", createdAt: new Date(), documents: docs, assetAssignments: assets };
}
describe("Integration: Full Onboarding Pipeline", () => {
    beforeEach(() => vi.clearAllMocks());
    it("advancing to SELECTION auto-creates OnboardingWorkflow", async () => {
        mockPrisma.application.findUnique.mockResolvedValueOnce(makeApp("INTERVIEW"));
        mockPrisma.application.update.mockResolvedValueOnce(makeApp("SELECTION"));
        mockPrisma.applicationStage.create.mockResolvedValueOnce({});
        mockPrisma.onboardingWorkflow.create.mockResolvedValueOnce({ id: WORKFLOW_ID, applicationId: APP_ID, status: "PENDING" });
        const result = await advanceStage(APP_ID, {}, recruitActor);
        expect(result.currentStage).toBe("SELECTION");
        expect(mockPrisma.onboardingWorkflow.create).toHaveBeenCalledOnce();
    });
    it("marks document as collected", async () => {
        const doc = { id: DOC_ID, documentType: "CONTRACT", isCollected: false, collectedAt: null };
        mockPrisma.onboardingWorkflow.findUnique.mockResolvedValueOnce(makeWorkflow([doc], []));
        mockPrisma.onboardingDocument.update.mockResolvedValueOnce({ ...doc, isCollected: true, collectedAt: new Date() });
        const result = await markDocumentCollected(WORKFLOW_ID, DOC_ID, actor);
        expect(result.isCollected).toBe(true);
    });
    it("marks asset as assigned", async () => {
        const asset = { id: ASSET_ID, assetName: "LAPTOP", isAssigned: false, assignedAt: null };
        mockPrisma.onboardingWorkflow.findUnique.mockResolvedValueOnce(makeWorkflow([], [asset]));
        mockPrisma.assetAssignment.update.mockResolvedValueOnce({ ...asset, isAssigned: true, assignedAt: new Date() });
        const result = await markAssetAssigned(WORKFLOW_ID, ASSET_ID, actor);
        expect(result.isAssigned).toBe(true);
    });
    it("completes onboarding and creates employee with generated ID", async () => {
        const doc = { id: DOC_ID, documentType: "CONTRACT", isCollected: true, collectedAt: new Date() };
        const asset = { id: ASSET_ID, assetName: "LAPTOP", isAssigned: true, assignedAt: new Date() };
        mockPrisma.onboardingWorkflow.findUnique.mockResolvedValueOnce(makeWorkflow([doc], [asset]));
        mockPrisma.$transaction.mockImplementationOnce(async (fn) => fn({ ...mockPrisma, employeeIDCounter: { upsert: vi.fn().mockResolvedValueOnce({ sequence: 1 }) } }));
        mockPrisma.campus.findUniqueOrThrow.mockResolvedValueOnce({ code: "BDU" });
        mockPrisma.employee.create.mockResolvedValueOnce({ id: "emp-new", employeeId: "BDU-2026-00001" });
        mockPrisma.onboardingWorkflow.update.mockResolvedValueOnce({ id: WORKFLOW_ID, status: "COMPLETED" });
        const result = await completeOnboarding(WORKFLOW_ID, actor);
        expect(result.status).toBe("COMPLETED");
        expect(mockPrisma.employee.create).toHaveBeenCalledOnce();
    });
    it("full pipeline: INTERVIEW→SELECTION→collect doc→assign asset→complete", async () => {
        mockPrisma.application.findUnique.mockResolvedValueOnce(makeApp("INTERVIEW"));
        mockPrisma.application.update.mockResolvedValueOnce(makeApp("SELECTION"));
        mockPrisma.applicationStage.create.mockResolvedValueOnce({});
        mockPrisma.onboardingWorkflow.create.mockResolvedValueOnce({ id: WORKFLOW_ID, applicationId: APP_ID, status: "PENDING" });
        await advanceStage(APP_ID, {}, recruitActor);
        expect(mockPrisma.onboardingWorkflow.create).toHaveBeenCalledOnce();
        const doc = { id: DOC_ID, documentType: "CONTRACT", isCollected: false, collectedAt: null };
        mockPrisma.onboardingWorkflow.findUnique.mockResolvedValueOnce(makeWorkflow([doc], []));
        mockPrisma.onboardingDocument.update.mockResolvedValueOnce({ ...doc, isCollected: true, collectedAt: new Date() });
        const collectedDoc = await markDocumentCollected(WORKFLOW_ID, DOC_ID, actor);
        expect(collectedDoc.isCollected).toBe(true);
        const asset = { id: ASSET_ID, assetName: "LAPTOP", isAssigned: false, assignedAt: null };
        mockPrisma.onboardingWorkflow.findUnique.mockResolvedValueOnce(makeWorkflow([], [asset]));
        mockPrisma.assetAssignment.update.mockResolvedValueOnce({ ...asset, isAssigned: true, assignedAt: new Date() });
        const assignedAsset = await markAssetAssigned(WORKFLOW_ID, ASSET_ID, actor);
        expect(assignedAsset.isAssigned).toBe(true);
        mockPrisma.onboardingWorkflow.findUnique.mockResolvedValueOnce(makeWorkflow([{ ...doc, isCollected: true, collectedAt: new Date() }], [{ ...asset, isAssigned: true, assignedAt: new Date() }]));
        mockPrisma.$transaction.mockImplementationOnce(async (fn) => fn({ ...mockPrisma, employeeIDCounter: { upsert: vi.fn().mockResolvedValueOnce({ sequence: 1 }) } }));
        mockPrisma.campus.findUniqueOrThrow.mockResolvedValueOnce({ code: "BDU" });
        mockPrisma.employee.create.mockResolvedValueOnce({ id: "emp-new", employeeId: "BDU-2026-00001" });
        mockPrisma.onboardingWorkflow.update.mockResolvedValueOnce({ id: WORKFLOW_ID, status: "COMPLETED" });
        const completed = await completeOnboarding(WORKFLOW_ID, actor);
        expect(completed.status).toBe("COMPLETED");
        expect(mockPrisma.employee.create).toHaveBeenCalledOnce();
    });
});
//# sourceMappingURL=onboarding.integration.test.js.map