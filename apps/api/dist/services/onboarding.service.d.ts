export interface ActorContext {
    userId: string;
    role: string;
    campusId: string;
    ipAddress: string;
}
export declare function getWorkflow(workflowId: string): Promise<{
    AssetAssignment: {
        id: string;
        assetName: string;
        assignedAt: Date | null;
        isAssigned: boolean;
        onboardingWorkflowId: string;
    }[];
    OnboardingDocument: {
        id: string;
        documentType: string;
        onboardingWorkflowId: string;
        isCollected: boolean;
        collectedAt: Date | null;
    }[];
} & {
    id: string;
    status: import("@prisma/client").$Enums.OnboardingStatus;
    createdAt: Date;
    applicationId: string;
}>;
export declare function markDocumentCollected(workflowId: string, docId: string, actor: ActorContext): Promise<{
    id: string;
    documentType: string;
    onboardingWorkflowId: string;
    isCollected: boolean;
    collectedAt: Date | null;
}>;
export declare function markAssetAssigned(workflowId: string, assetId: string, actor: ActorContext): Promise<{
    id: string;
    assetName: string;
    assignedAt: Date | null;
    isAssigned: boolean;
    onboardingWorkflowId: string;
}>;
export declare function completeOnboarding(workflowId: string, actor: ActorContext): Promise<{
    id: string;
    status: import("@prisma/client").$Enums.OnboardingStatus;
    createdAt: Date;
    applicationId: string;
}>;
//# sourceMappingURL=onboarding.service.d.ts.map