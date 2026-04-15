import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { logActivity } from "../middleware/activityLogger.js";
import { generate } from "./employeeId.service.js";
export async function getWorkflow(workflowId) {
    const workflow = await prisma.onboardingWorkflow.findUnique({
        where: { id: workflowId },
        include: { OnboardingDocument: true, AssetAssignment: true },
    });
    if (!workflow)
        throw new AppError(404, "NOT_FOUND", "Onboarding workflow not found");
    return workflow;
}
export async function markDocumentCollected(workflowId, docId, actor) {
    const workflow = await getWorkflow(workflowId);
    const doc = workflow.OnboardingDocument.find((d) => d.id === docId);
    if (!doc)
        throw new AppError(404, "NOT_FOUND", "Onboarding document not found");
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
export async function markAssetAssigned(workflowId, assetId, actor) {
    const workflow = await getWorkflow(workflowId);
    const asset = workflow.AssetAssignment.find((a) => a.id === assetId);
    if (!asset)
        throw new AppError(404, "NOT_FOUND", "Asset assignment not found");
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
export async function completeOnboarding(workflowId, actor) {
    const workflow = await getWorkflow(workflowId);
    const missingDocuments = workflow.OnboardingDocument
        .filter((d) => !d.isCollected)
        .map((d) => d.documentType);
    const missingAssets = workflow.AssetAssignment
        .filter((a) => !a.isAssigned)
        .map((a) => a.assetName);
    if (missingDocuments.length > 0 || missingAssets.length > 0) {
        throw new AppError(422, "ONBOARDING_INCOMPLETE", "Onboarding is not complete", { missingDocuments, missingAssets });
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
//# sourceMappingURL=onboarding.service.js.map