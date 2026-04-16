import { z } from "zod";
// Enum schemas
export const BaseRoleSchema = z.enum([
    "SUPER_ADMIN",
    "ADMIN",
    "HR_OFFICER",
    "EMPLOYEE",
]);
export const SpecialPrivilegeSchema = z.enum([
    "UNIVERSITY_PRESIDENT",
    "VICE_PRESIDENT",
    "DEAN",
    "DIRECTOR",
]);
export const GenderSchema = z.enum(["MALE", "FEMALE", "OTHER"]);
export const AcademicRankSchema = z.enum([
    "LECTURER",
    "ASSISTANT_PROFESSOR",
    "ASSOCIATE_PROFESSOR",
]);
export const EmployeeStatusSchema = z.enum(["ACTIVE", "INACTIVE", "PENDING"]);
// Campus schemas
export const CreateCampusSchema = z.object({
    code: z.string().min(1).max(20),
    name: z.string().min(1),
});
export const UpdateCampusSchema = z.object({
    name: z.string().min(1),
});
// College schemas
export const CreateCollegeSchema = z.object({
    name: z.string().min(1),
    campusId: z.string().uuid(),
});
// Department schemas
export const CreateDepartmentSchema = z.object({
    name: z.string().min(1),
    collegeId: z.string().uuid(),
});
// Unit schemas
export const CreateUnitSchema = z.object({
    name: z.string().min(1),
    departmentId: z.string().uuid(),
});
// Employee schemas
export const CreateEmployeeSchema = z.object({
    fullName: z.string().min(1).optional(),
    dateOfBirth: z.string().datetime().optional(),
    gender: GenderSchema.optional(),
    nationality: z.string().optional(),
    contactInfo: z
        .object({
        phone: z.string().optional(),
        email: z.string().email().optional(),
        address: z.string().optional(),
    })
        .optional(),
    emergencyContact: z
        .object({
        name: z.string().optional(),
        phone: z.string().optional(),
        relationship: z.string().optional(),
    })
        .optional(),
    academicRank: AcademicRankSchema.optional(),
    campusId: z.string().uuid(),
    departmentId: z.string().uuid().optional(),
    unitId: z.string().uuid().optional(),
});
// Auth schemas
export const LoginSchema = z.object({
    employeeId: z.string().min(1),
    password: z.string().min(1),
});
export const ChangePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
});
// Leave schemas
export const LeaveTypeNameSchema = z.enum([
    "ANNUAL",
    "MATERNITY_PRENATAL",
    "MATERNITY_POSTNATAL",
    "PATERNITY",
    "SICK_FULL",
    "SICK_HALF",
    "PERSONAL",
    "SPECIAL",
    "LEAVE_WITHOUT_PAY",
    "STUDY",
    "RESEARCH",
    "SABBATICAL",
    "SEMINAR",
]);
export const LeaveStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export const CreateLeaveApplicationSchema = z.object({
    leaveTypeId: z.string().uuid(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    reason: z.string().min(1),
    supportingDocs: z.array(z.string().url()).optional().default([]),
});
// Recruitment schemas
export const PostingTypeSchema = z.enum(["INTERNAL", "EXTERNAL"]);
export const RecruitmentStageSchema = z.enum([
    "SCREENING",
    "INTERVIEW",
    "SELECTION",
    "OFFER",
]);
export const CreateJobPostingSchema = z.object({
    type: PostingTypeSchema,
    title: z.string().min(1),
    description: z.string().min(1),
    requirements: z.string().min(1),
    deadline: z.string().datetime(),
    isAcademic: z.boolean().default(false),
});
export const SubmitApplicationSchema = z.object({
    candidateName: z.string().min(1),
    candidateEmail: z.string().email(),
});
//# sourceMappingURL=schemas.js.map