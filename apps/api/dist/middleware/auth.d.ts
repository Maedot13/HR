import type { Request, Response, NextFunction } from "express";
/**
 * JWT verification middleware.
 * Extracts userId, role, specialPrivilege, campusId, isTempPassword from Bearer token
 * and attaches them to req.user.
 */
export declare function authenticate(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=auth.d.ts.map