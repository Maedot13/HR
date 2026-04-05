import { z } from "zod";
import {
  BaseRoleSchema,
  SpecialPrivilegeSchema,
  GenderSchema,
  AcademicRankSchema,
  EmployeeStatusSchema,
} from "./schemas.js";

// Enums
export type BaseRole = z.infer<typeof BaseRoleSchema>;
export type SpecialPrivilege = z.infer<typeof SpecialPrivilegeSchema>;
export type Gender = z.infer<typeof GenderSchema>;
export type AcademicRank = z.infer<typeof AcademicRankSchema>;
export type EmployeeStatus = z.infer<typeof EmployeeStatusSchema>;

// Domain types
export interface EffectivePermissions {
  role: BaseRole;
  privilege?: SpecialPrivilege;
  permissions: Set<string>;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
