export interface ActorContext {
    userId: string;
    role: string;
    ipAddress: string;
}
export declare const STAGE_ORDER: readonly ["SCREENING", "INTERVIEW", "SELECTION", "OFFER"];
export declare function createPosting(data: {
    type: "INTERNAL" | "EXTERNAL";
    title: string;
    description: string;
    requirements: string;
    deadline: string;
    isAcademic?: boolean;
}, actor: ActorContext): Promise<{
    id: string;
    createdAt: Date;
    createdBy: string;
    type: import("@prisma/client").$Enums.PostingType;
    title: string;
    description: string;
    requirements: string;
    deadline: Date;
    isAcademic: boolean;
}>;
export declare function listPostings(filters?: {
    type?: string;
    isAcademic?: boolean;
}): Promise<{
    id: string;
    createdAt: Date;
    createdBy: string;
    type: import("@prisma/client").$Enums.PostingType;
    title: string;
    description: string;
    requirements: string;
    deadline: Date;
    isAcademic: boolean;
}[]>;
export declare function getPosting(id: string): Promise<{
    Application: ({
        ApplicationStage: {
            id: string;
            stage: import("@prisma/client").$Enums.RecruitmentStage;
            transitionedAt: Date;
            transitionedBy: string;
            applicationId: string;
        }[];
    } & {
        id: string;
        candidateName: string;
        candidateEmail: string;
        submittedAt: Date;
        currentStage: import("@prisma/client").$Enums.RecruitmentStage;
        publicationEvalScore: number | null;
        jobPostingId: string;
    })[];
} & {
    id: string;
    createdAt: Date;
    createdBy: string;
    type: import("@prisma/client").$Enums.PostingType;
    title: string;
    description: string;
    requirements: string;
    deadline: Date;
    isAcademic: boolean;
}>;
export declare function updatePosting(id: string, data: {
    type?: "INTERNAL" | "EXTERNAL";
    title?: string;
    description?: string;
    requirements?: string;
    deadline?: string;
    isAcademic?: boolean;
}, actor: ActorContext): Promise<{
    id: string;
    createdAt: Date;
    createdBy: string;
    type: import("@prisma/client").$Enums.PostingType;
    title: string;
    description: string;
    requirements: string;
    deadline: Date;
    isAcademic: boolean;
}>;
export declare function submitApplication(jobPostingId: string, data: {
    candidateName: string;
    candidateEmail: string;
}, actor: ActorContext): Promise<{
    id: string;
    candidateName: string;
    candidateEmail: string;
    submittedAt: Date;
    currentStage: import("@prisma/client").$Enums.RecruitmentStage;
    publicationEvalScore: number | null;
    jobPostingId: string;
}>;
export declare function advanceStage(applicationId: string, data: {
    publicationEvalScore?: number;
}, actor: ActorContext): Promise<{
    id: string;
    candidateName: string;
    candidateEmail: string;
    submittedAt: Date;
    currentStage: import("@prisma/client").$Enums.RecruitmentStage;
    publicationEvalScore: number | null;
    jobPostingId: string;
}>;
export declare function issueOffer(applicationId: string, offerDetails: {
    notes?: string;
}, actor: ActorContext): Promise<{
    id: string;
    candidateName: string;
    candidateEmail: string;
    submittedAt: Date;
    currentStage: import("@prisma/client").$Enums.RecruitmentStage;
    publicationEvalScore: number | null;
    jobPostingId: string;
}>;
//# sourceMappingURL=recruitment.service.d.ts.map