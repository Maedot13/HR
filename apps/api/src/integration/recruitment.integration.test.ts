/**
 * Integration Test: Full Recruitment Pipeline
 * Validates: Requirements 6.1–6.7
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  jobPosting: { create: vi.fn(), findUnique: vi.fn() },
  application: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  applicationStage: { create: vi.fn() },
  onboardingWorkflow: { create: vi.fn() },
  activityLog: { create: vi.fn() },
}));

vi.mock("../lib/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../middleware/activityLogger.js", () => ({ logActivity: vi.fn() }));

import { createPosting, submitApplication, advanceStage, issueOffer } from "../services/recruitment.service.js";

const actor = { userId: "actor-1", role: "HR_OFFICER", campusId: "campus-1", ipAddress: "127.0.0.1" };
const POSTING_ID = "posting-1";
const APP_ID = "app-1";

function makePosting() {
  return { id: POSTING_ID, type: "EXTERNAL", title: "Software Engineer", description: "Build great things", requirements: "TypeScript", deadline: new Date(Date.now() + 86400_000), isAcademic: false, createdBy: actor.userId, createdAt: new Date() };
}

function makeApp(stage: string) {
  return { id: APP_ID, jobPostingId: POSTING_ID, jobPosting: makePosting(), candidateName: "Jane Doe", candidateEmail: "jane@example.com", currentStage: stage, publicationEvalScore: null, submittedAt: new Date() };
}

describe("Integration: Full Recruitment Pipeline", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a job posting", async () => {
    mockPrisma.jobPosting.create.mockResolvedValueOnce(makePosting());
    const result = await createPosting({ type: "EXTERNAL", title: "Software Engineer", description: "Build great things", requirements: "TypeScript", deadline: new Date(Date.now() + 86400_000).toISOString() }, actor);
    expect(result.id).toBe(POSTING_ID);
  });

  it("submits application with SCREENING stage", async () => {
    mockPrisma.jobPosting.findUnique.mockResolvedValueOnce(makePosting());
    mockPrisma.application.create.mockResolvedValueOnce(makeApp("SCREENING"));
    mockPrisma.applicationStage.create.mockResolvedValueOnce({});
    const result = await submitApplication(POSTING_ID, { candidateName: "Jane Doe", candidateEmail: "jane@example.com" }, actor);
    expect(result.currentStage).toBe("SCREENING");
  });

  it("advances SCREENING → INTERVIEW (no workflow created)", async () => {
    mockPrisma.application.findUnique.mockResolvedValueOnce(makeApp("SCREENING"));
    mockPrisma.application.update.mockResolvedValueOnce(makeApp("INTERVIEW"));
    mockPrisma.applicationStage.create.mockResolvedValueOnce({});
    const result = await advanceStage(APP_ID, {}, actor);
    expect(result.currentStage).toBe("INTERVIEW");
    expect(mockPrisma.onboardingWorkflow.create).not.toHaveBeenCalled();
  });

  it("advances INTERVIEW → SELECTION and auto-creates OnboardingWorkflow", async () => {
    mockPrisma.application.findUnique.mockResolvedValueOnce(makeApp("INTERVIEW"));
    mockPrisma.application.update.mockResolvedValueOnce(makeApp("SELECTION"));
    mockPrisma.applicationStage.create.mockResolvedValueOnce({});
    mockPrisma.onboardingWorkflow.create.mockResolvedValueOnce({ id: "workflow-1", applicationId: APP_ID, status: "PENDING" });
    const result = await advanceStage(APP_ID, {}, actor);
    expect(result.currentStage).toBe("SELECTION");
    expect(mockPrisma.onboardingWorkflow.create).toHaveBeenCalledOnce();
  });

  it("issues offer from SELECTION stage", async () => {
    mockPrisma.application.findUnique.mockResolvedValueOnce(makeApp("SELECTION"));
    mockPrisma.application.update.mockResolvedValueOnce(makeApp("OFFER"));
    mockPrisma.applicationStage.create.mockResolvedValueOnce({});
    const result = await issueOffer(APP_ID, {}, actor);
    expect(result.currentStage).toBe("OFFER");
  });

  it("full pipeline end-to-end", async () => {
    mockPrisma.jobPosting.create.mockResolvedValueOnce(makePosting());
    const posting = await createPosting({ type: "EXTERNAL", title: "SE", description: "desc", requirements: "req", deadline: new Date(Date.now() + 86400_000).toISOString() }, actor);
    expect(posting.id).toBe(POSTING_ID);

    mockPrisma.jobPosting.findUnique.mockResolvedValueOnce(makePosting());
    mockPrisma.application.create.mockResolvedValueOnce(makeApp("SCREENING"));
    mockPrisma.applicationStage.create.mockResolvedValueOnce({});
    const app = await submitApplication(POSTING_ID, { candidateName: "Jane", candidateEmail: "jane@test.com" }, actor);
    expect(app.currentStage).toBe("SCREENING");

    mockPrisma.application.findUnique.mockResolvedValueOnce(makeApp("SCREENING"));
    mockPrisma.application.update.mockResolvedValueOnce(makeApp("INTERVIEW"));
    mockPrisma.applicationStage.create.mockResolvedValueOnce({});
    await advanceStage(APP_ID, {}, actor);

    mockPrisma.application.findUnique.mockResolvedValueOnce(makeApp("INTERVIEW"));
    mockPrisma.application.update.mockResolvedValueOnce(makeApp("SELECTION"));
    mockPrisma.applicationStage.create.mockResolvedValueOnce({});
    mockPrisma.onboardingWorkflow.create.mockResolvedValueOnce({ id: "wf-1", applicationId: APP_ID, status: "PENDING" });
    const atSelection = await advanceStage(APP_ID, {}, actor);
    expect(atSelection.currentStage).toBe("SELECTION");
    expect(mockPrisma.onboardingWorkflow.create).toHaveBeenCalledOnce();

    mockPrisma.application.findUnique.mockResolvedValueOnce(makeApp("SELECTION"));
    mockPrisma.application.update.mockResolvedValueOnce(makeApp("OFFER"));
    mockPrisma.applicationStage.create.mockResolvedValueOnce({});
    const offer = await issueOffer(APP_ID, {}, actor);
    expect(offer.currentStage).toBe("OFFER");
  });
});
