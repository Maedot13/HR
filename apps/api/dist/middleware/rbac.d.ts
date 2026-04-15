import type { Request, Response, NextFunction } from "express";
/**
 * RBAC middleware factory.
 *
 * Returns an Express middleware that:
 * 1. Reads `req.user.role` and `req.user.specialPrivilege` (populated by JWT middleware)
 * 2. Computes the effective permission set via `computeEffectivePermissions`
 * 3. Calls `next()` if the required permission is present
 * 4. Returns HTTP 403 with the global error envelope if the permission is absent
 *
 * @param permission - The permission code that must be present (e.g. "employee:read")
 *
 * @example
 * router.get("/employees", authenticate, requirePermission("employee:read"), listEmployees);
 */
export declare function requirePermission(permission: string): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=rbac.d.ts.map