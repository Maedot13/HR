export interface ActorContext {
    userId: string;
    role: string;
    specialPrivilege?: string;
    campusId: string;
    ipAddress: string;
}
export declare function createProgram(data: {
    title: string;
    description: string;
    competencies: string[];
}, actor: ActorContext): Promise<{
    id: string;
    title: string;
    description: string;
    competencies: string[];
}>;
export declare function listPrograms(): Promise<{
    id: string;
    title: string;
    description: string;
    competencies: string[];
}[]>;
export declare function assignTraining(employeeId: string, data: {
    trainingProgramId: string;
    expectedCompletion: string;
}, actor: ActorContext): Promise<{
    id: string;
    employeeId: string;
    status: import("@prisma/client").$Enums.TrainingStatus;
    assignedDate: Date;
    expectedCompletion: Date;
    completionDate: Date | null;
    trainingProgramId: string;
}>;
export declare function completeTraining(assignmentId: string, actor: ActorContext): Promise<{
    id: string;
    employeeId: string;
    status: import("@prisma/client").$Enums.TrainingStatus;
    assignedDate: Date;
    expectedCompletion: Date;
    completionDate: Date | null;
    trainingProgramId: string;
}>;
export declare function getSkillGapReport(employeeId: string): Promise<{
    required: string[];
    completed: string[];
    gaps: string[];
}>;
//# sourceMappingURL=training.service.d.ts.map