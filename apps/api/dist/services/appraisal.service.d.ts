export interface ActorContext {
    userId: string;
    role: string;
    specialPrivilege?: string;
    campusId: string;
    ipAddress: string;
}
export declare function createEvaluation(employeeId: string, data: {
    evaluationPeriod: string;
    efficiencyScore: number;
    workOutputScore: number;
}, actor: ActorContext): Promise<{
    id: string;
    employeeId: string;
    createdAt: Date;
    updatedAt: Date;
    evaluationPeriod: string;
    efficiencyScore: number;
    workOutputScore: number;
    createdBy: string;
}>;
export declare function getEvaluation(id: string): Promise<{
    id: string;
    employeeId: string;
    createdAt: Date;
    updatedAt: Date;
    evaluationPeriod: string;
    efficiencyScore: number;
    workOutputScore: number;
    createdBy: string;
}>;
export declare function updateEvaluation(id: string, data: Partial<{
    evaluationPeriod: string;
    efficiencyScore: number;
    workOutputScore: number;
}>, actor: ActorContext): Promise<{
    id: string;
    employeeId: string;
    createdAt: Date;
    updatedAt: Date;
    evaluationPeriod: string;
    efficiencyScore: number;
    workOutputScore: number;
    createdBy: string;
}>;
export declare function listEvaluations(employeeId: string): Promise<{
    id: string;
    employeeId: string;
    createdAt: Date;
    updatedAt: Date;
    evaluationPeriod: string;
    efficiencyScore: number;
    workOutputScore: number;
    createdBy: string;
}[]>;
//# sourceMappingURL=appraisal.service.d.ts.map