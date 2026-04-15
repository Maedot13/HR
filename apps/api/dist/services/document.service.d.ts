export interface ActorContext {
    userId: string;
    role: string;
    specialPrivilege?: string;
    campusId: string;
    ipAddress: string;
}
export declare function generateExperienceLetter(employeeId: string, format: "PDF" | "DOCX", actor: ActorContext): Promise<{
    fullName: string;
    positionTitle: string;
    hireDate: Date;
    endDate: Date;
    duration: string;
    id: string;
    generatedBy: string;
    generatedAt: Date;
    format: import("@prisma/client").$Enums.LetterFormat;
    fileUrl: string;
    employeeId: string;
}>;
export declare function listExperienceLetters(employeeId: string): Promise<{
    id: string;
    generatedBy: string;
    generatedAt: Date;
    format: import("@prisma/client").$Enums.LetterFormat;
    fileUrl: string;
    employeeId: string;
}[]>;
//# sourceMappingURL=document.service.d.ts.map