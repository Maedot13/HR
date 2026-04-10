import type { Request, Response, NextFunction } from "express";
import { computeEffectivePermissions } from "@hrms/shared";

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
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { role, specialPrivilege } = req.user;
    const effective = computeEffectivePermissions(role, specialPrivilege);

    if (!effective.has(permission)) {
      res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: `You do not have the required permission: ${permission}`,
        },
      });
      return;
    }

    next();
  };
}
