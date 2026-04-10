import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { logActivity } from "../middleware/activityLogger.js";
import { generate } from "./employeeId.service.js";

export interface ActorContext {
  userId: string;
  role: string;
  campusId: string;
  ipAddress: string;
}

export async function getWorkflow(workflowId: string) {
  const workflow = await prisma.onboardingWorkflow.findUnique({
    where: { id: workflowId },
    include: { OnboardingDocument: true, AssetAssignment: true },
  });
  if (!workflow) throw new AppError(404, "NOT_FOUND", "Onboarding workflow not found");
  return workflow;
}

export async function markDocumentCollected(
  workflowId: string,
  docId: string,
  actor: ActorContext
) {
  const workflow = await getWorkflow(workflowId);
  const doc = workflow.OnboardingDocument.find((d: { id: string }) => d.id === docId);
  if (!doc) throw new AppError(404, "NOT_FOUND", "Onboarding document not found");

  const updated = await prisma.onboardingDocument.update({
    where: { id: docId },
    data: { isCollected: true, collectedAt: new Date() },
  });

  await logActivity({
    actingUserId: actor.userId,
    actingRole: actor.role,
    actionType: "ONBOARDING_DOCUMENT_COLLECTED",
    resourceType: "OnboardingDocument",
    resourceId: docId,
    previousState: { isCollected: false },
    newState: { isCollected: true, collectedAt: updated.collectedAt },
    ipAddress: actor.ipAddress,
  });

  return updated;
}

export async function markAssetAssigned(
  workflowId: string,
  assetId: string,
  actor: ActorContext
) {
  const workflow = await getWorkflow(workflowId);
  const asset = workflow.AssetAssignment.find((a: { id: string }) => a.id === assetId);
  if (!asset) throw new AppError(404, "NOT_FOUND", "Asset assignment not found");

  const updated = await prisma.assetAssignment.update({
    where: { id: assetId },
    data: { isAssigned: true, assignedAt: new Date() },
  });

  await logActivity({
    actingUserId: actor.userId,
    actingRole: actor.role,
    actionType: "ONBOARDING_ASSET_ASSIGNED",
    resourceType: "AssetAssignment",
    resourceId: assetId,
    previousState: { isAssigned: false },
    newState: { isAssigned: true, assignedAt: updated.assignedAt },
    ipAddress: actor.ipAddress,
  });

  return updated;
}

export async function completeOnboarding(workflowId: string, actor: ActorContext) {
  const workflow = await getWorkflow(workflowId);

  const missingDocuments = workflow.OnboardingDocument
    .filter((d: { isCollected: boolean }) => !d.isCollected)
    .map((d: { documentType: string }) => d.documentType);

  const missingAssets = workflow.AssetAssignment
    .filter((a: { isAssigned: boolean }) => !a.isAssigned)
    .map((a: { assetName: string }) => a.assetName);

  if (missingDocuments.length > 0 || missingAssets.length > 0) {
    throw new AppError(
      422,
      "ONBOARDING_INCOMPLETE",
      "Onboarding is not complete",
      { missingDocuments, missingAssets }
    );
  }

  const employeeId = await generate(actor.campusId, new Date().getFullYear());

  await prisma.employee.create({
    data: {
      employeeId,
      campusId: actor.campusId,
      status: "PENDING",
      passwordHash: "TEMP",
      isTempPassword: true,
      fullName: "",
      dateOfBirth: new Date(),
      gender: "MALE",
      nationality: "",
      contactInfo: {},
      emergencyContact: {},
    },
  });

  const updated = await prisma.onboardingWorkflow.update({
    where: { id: workflowId },
    data: { status: "COMPLETED" },
  });

  await logActivity({
    actingUserId: actor.userId,
    actingRole: actor.role,
    actionType: "ONBOARDING_COMPLETED",
    resourceType: "OnboardingWorkflow",
    resourceId: workflowId,
    previousState: { status: workflow.status },
    newState: { status: "COMPLETED", employeeId },
    ipAddress: actor.ipAddress,
  });

  return updated;
}
