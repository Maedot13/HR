import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { logActivity } from "../middleware/activityLogger.js";

export interface ActorContext {
  userId: string;
  role: string;
  ipAddress: string;
}

export const STAGE_ORDER = ["SCREENING", "INTERVIEW", "SELECTION", "OFFER"] as const;
type RecruitmentStage = (typeof STAGE_ORDER)[number];

export async function createPosting(
  data: {
    type: "INTERNAL" | "EXTERNAL";
    title: string;
    description: string;
    requirements: string;
    deadline: string;
    isAcademic?: boolean;
  },
  actor: ActorContext
) {
  const posting = await prisma.jobPosting.create({
    data: {
      type: data.type,
      title: data.title,
      description: data.description,
      requirements: data.requirements,
      deadline: new Date(data.deadline),
      isAcademic: data.isAcademic ?? false,
      createdBy: actor.userId,
    },
  });
  await logActivity({
    actingUserId: actor.userId,
    actingRole: actor.role,
    actionType: "JOB_POSTING_CREATED",
    resourceType: "JobPosting",
    resourceId: posting.id,
    newState: { title: posting.title, type: posting.type },
    ipAddress: actor.ipAddress,
  });
  return posting;
}

export async function listPostings(filters?: { type?: string; isAcademic?: boolean }) {
  return prisma.jobPosting.findMany({
    where: {
      ...(filters?.type ? { type: filters.type as "INTERNAL" | "EXTERNAL" } : {}),
      ...(filters?.isAcademic !== undefined ? { isAcademic: filters.isAcademic } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPosting(id: string) {
  const posting = await prisma.jobPosting.findUnique({
    where: { id },
    include: { Application: { include: { ApplicationStage: true } } },
  });
  if (!posting) throw new AppError(404, "NOT_FOUND", "Job posting not found");
  return posting;
}

export async function updatePosting(
  id: string,
  data: {
    type?: "INTERNAL" | "EXTERNAL";
    title?: string;
    description?: string;
    requirements?: string;
    deadline?: string;
    isAcademic?: boolean;
  },
  actor: ActorContext
) {
  const existing = await prisma.jobPosting.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "NOT_FOUND", "Job posting not found");

  const updateData: Record<string, unknown> = {};
  if (data.type !== undefined) updateData.type = data.type;
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.requirements !== undefined) updateData.requirements = data.requirements;
  if (data.deadline !== undefined) updateData.deadline = new Date(data.deadline);
  if (data.isAcademic !== undefined) updateData.isAcademic = data.isAcademic;

  const updated = await prisma.jobPosting.update({
    where: { id },
    data: updateData,
  });
  await logActivity({
    actingUserId: actor.userId,
    actingRole: actor.role,
    actionType: "JOB_POSTING_UPDATED",
    resourceType: "JobPosting",
    resourceId: id,
    previousState: existing,
    newState: updated,
    ipAddress: actor.ipAddress,
  });
  return updated;
}

export async function submitApplication(
  jobPostingId: string,
  data: { candidateName: string; candidateEmail: string },
  actor: ActorContext
) {
  const posting = await prisma.jobPosting.findUnique({ where: { id: jobPostingId } });
  if (!posting) throw new AppError(404, "NOT_FOUND", "Job posting not found");

  if (new Date() > posting.deadline) {
    throw new AppError(422, "APPLICATION_AFTER_DEADLINE", "Application deadline has passed");
  }

  const application = await prisma.application.create({
    data: {
      jobPostingId,
      candidateName: data.candidateName,
      candidateEmail: data.candidateEmail,
      currentStage: "SCREENING",
    },
  });

  await prisma.applicationStage.create({
    data: { applicationId: application.id, stage: "SCREENING", transitionedBy: actor.userId },
  });

  await logActivity({
    actingUserId: actor.userId,
    actingRole: actor.role,
    actionType: "APPLICATION_SUBMITTED",
    resourceType: "Application",
    resourceId: application.id,
    newState: { jobPostingId, candidateName: data.candidateName, stage: "SCREENING" },
    ipAddress: actor.ipAddress,
  });
  return application;
}

export async function advanceStage(
  applicationId: string,
  data: { publicationEvalScore?: number },
  actor: ActorContext
) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { JobPosting: true },
  });
  if (!application) throw new AppError(404, "NOT_FOUND", "Application not found");

  const currentIndex = STAGE_ORDER.indexOf(application.currentStage as RecruitmentStage);
  if (currentIndex === -1 || currentIndex >= STAGE_ORDER.length - 1) {
    throw new AppError(422, "INVALID_STAGE_TRANSITION", "Cannot advance beyond the final stage");
  }

  const nextStage = STAGE_ORDER[currentIndex + 1];

  if (
    application.currentStage === "SCREENING" &&
    application.JobPosting.isAcademic &&
    application.publicationEvalScore == null &&
    data.publicationEvalScore == null
  ) {
    throw new AppError(
      422,
      "ACADEMIC_SCORE_REQUIRED",
      "Publication evaluation score is required for academic roles"
    );
  }

  const updateData: Record<string, unknown> = { currentStage: nextStage };
  if (data.publicationEvalScore != null) updateData.publicationEvalScore = data.publicationEvalScore;

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: updateData,
  });

  await prisma.applicationStage.create({
    data: { applicationId, stage: nextStage, transitionedBy: actor.userId },
  });

  if (nextStage === "SELECTION") {
    await prisma.onboardingWorkflow.create({ data: { applicationId, status: "PENDING" } });
  }

  await logActivity({
    actingUserId: actor.userId,
    actingRole: actor.role,
    actionType: "APPLICATION_STAGE_ADVANCED",
    resourceType: "Application",
    resourceId: applicationId,
    previousState: { stage: application.currentStage },
    newState: { stage: nextStage },
    ipAddress: actor.ipAddress,
  });
  return updated;
}

export async function issueOffer(
  applicationId: string,
  offerDetails: { notes?: string },
  actor: ActorContext
) {
  const application = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!application) throw new AppError(404, "NOT_FOUND", "Application not found");

  if (application.currentStage !== "SELECTION") {
    throw new AppError(
      422,
      "INVALID_STAGE_FOR_OFFER",
      "Offer can only be issued when application is in SELECTION stage"
    );
  }

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: { currentStage: "OFFER" },
  });

  await prisma.applicationStage.create({
    data: { applicationId, stage: "OFFER", transitionedBy: actor.userId },
  });

  await logActivity({
    actingUserId: actor.userId,
    actingRole: actor.role,
    actionType: "APPLICATION_OFFER_ISSUED",
    resourceType: "Application",
    resourceId: applicationId,
    previousState: { stage: "SELECTION" },
    newState: { stage: "OFFER", notes: offerDetails.notes },
    ipAddress: actor.ipAddress,
  });
  return updated;
}
