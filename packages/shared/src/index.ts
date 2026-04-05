// Types
export type {
  BaseRole,
  SpecialPrivilege,
  Gender,
  AcademicRank,
  EmployeeStatus,
  EffectivePermissions,
  ErrorResponse,
} from "./types.js";

// Zod schemas
export {
  BaseRoleSchema,
  SpecialPrivilegeSchema,
  GenderSchema,
  AcademicRankSchema,
  EmployeeStatusSchema,
  CreateCampusSchema,
  UpdateCampusSchema,
  CreateCollegeSchema,
  CreateDepartmentSchema,
  CreateUnitSchema,
  CreateEmployeeSchema,
  LoginSchema,
  ChangePasswordSchema,
  LeaveTypeNameSchema,
  LeaveStatusSchema,
  CreateLeaveApplicationSchema,
  PostingTypeSchema,
  RecruitmentStageSchema,
  CreateJobPostingSchema,
  SubmitApplicationSchema,
} from "./schemas.js";

// Constants
export { PERMISSIONS, ROLE_PERMISSIONS, PRIVILEGE_PERMISSIONS } from "./constants.js";

// Permission computation
export { computeEffectivePermissions } from "./permissions.js";
