import type { Request, Response, NextFunction } from "express";

/**
 * First-login enforcement middleware.
 * Rejects all requests (except POST /auth/change-password) with 403
 * PASSWORD_CHANGE_REQUIRED when the authenticated user has isTempPassword = true.
 *
 * Must be applied AFTER the authenticate middleware.
 */
export function enforcePasswordChange(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Allow the change-password endpoint through unconditionally
  if (req.method === "POST" && req.path === "/auth/change-password") {
    next();
    return;
  }

  if (req.user?.isTempPassword === true) {
    res.status(403).json({
      error: {
        code: "PASSWORD_CHANGE_REQUIRED",
        message:
          "You must change your temporary password before accessing this resource",
      },
    });
    return;
  }

  next();
}
