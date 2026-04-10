import type { BaseRole, SpecialPrivilege } from "@hrms/shared";

declare global {
  namespace Express {
    interface Request {
      /** Populated by JWT verification middleware */
      user: {
        userId: string;
        role: BaseRole;
        specialPrivilege?: SpecialPrivilege;
        campusId: string;
        isTempPassword: boolean;
      };
      /** Unique request ID injected by request-id middleware */
      requestId: string;
    }
  }
}
