import type { Request, Response, NextFunction } from "express";
/**
 * First-login enforcement middleware.
 * Rejects all requests (except POST /auth/change-password) with 403
 * PASSWORD_CHANGE_REQUIRED when the authenticated user has isTempPassword = true.
 *
 * Must be applied AFTER the authenticate middleware.
 */
export declare function enforcePasswordChange(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=firstLogin.d.ts.map