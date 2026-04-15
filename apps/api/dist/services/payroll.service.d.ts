export interface ActorContext {
    userId: string;
    role: string;
    specialPrivilege?: string;
    campusId: string;
    ipAddress: string;
}
export declare function generateReport(period: string, actor: ActorContext): Promise<{
    id: string;
    generatedBy: string;
    generatedAt: Date;
    status: import("@prisma/client").$Enums.ReportStatus;
    period: string;
}>;
export declare function getReport(id: string): Promise<{
    PayrollExport: {
        id: string;
        format: import("@prisma/client").$Enums.PayrollExportFormat;
        fileUrl: string;
        payrollReportId: string;
        exportedAt: Date;
    }[];
} & {
    id: string;
    generatedBy: string;
    generatedAt: Date;
    status: import("@prisma/client").$Enums.ReportStatus;
    period: string;
}>;
export declare function listReports(): Promise<({
    PayrollExport: {
        id: string;
        format: import("@prisma/client").$Enums.PayrollExportFormat;
        fileUrl: string;
        payrollReportId: string;
        exportedAt: Date;
    }[];
} & {
    id: string;
    generatedBy: string;
    generatedAt: Date;
    status: import("@prisma/client").$Enums.ReportStatus;
    period: string;
})[]>;
export declare function exportReport(reportId: string, format: "EXCEL" | "PDF" | "DOCX", actor: ActorContext): Promise<{
    id: string;
    format: import("@prisma/client").$Enums.PayrollExportFormat;
    fileUrl: string;
    payrollReportId: string;
    exportedAt: Date;
}>;
export declare function validateReport(reportId: string, actor: ActorContext): Promise<{
    id: string;
    generatedBy: string;
    generatedAt: Date;
    status: import("@prisma/client").$Enums.ReportStatus;
    period: string;
}>;
//# sourceMappingURL=payroll.service.d.ts.map