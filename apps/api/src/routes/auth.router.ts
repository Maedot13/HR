import { Router } from "express";
import { LoginSchema, ChangePasswordSchema } from "@hrms/shared";
import { authenticate } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";
import { login, changePassword, logout, refresh } from "../services/auth.service.js";

const router = Router();

/**
 * POST /api/v1/auth/login
 * Public — no JWT required.
 */
router.post("/login", async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(422, "VALIDATION_ERROR", "Request validation failed", parsed.error.issues);
  }

  const { employeeId, password } = parsed.data;
  const ipAddress = req.ip ?? "unknown";

  const result = await login(employeeId, password, ipAddress);

  res.status(200).json({ data: result });
});

/**
 * POST /api/v1/auth/change-password
 * Requires JWT (authenticate middleware), but exempt from firstLogin enforcement.
 */
router.post("/change-password", authenticate, async (req, res) => {
  const parsed = ChangePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(422, "VALIDATION_ERROR", "Request validation failed", parsed.error.issues);
  }

  const { currentPassword, newPassword } = parsed.data;
  const ipAddress = req.ip ?? "unknown";
  // If the user is still on a temp password they just proved their identity
  // moments ago at login — no need to re-type the random temp password.
  const skipCurrentPasswordCheck = Boolean(req.user.isTempPassword);

  await changePassword(req.user.userId, currentPassword, newPassword, ipAddress, skipCurrentPasswordCheck);

  res.status(200).json({ data: { message: "Password changed successfully" } });
});

/**
 * POST /api/v1/auth/logout
 * Requires JWT (authenticate middleware).
 */
router.post("/logout", authenticate, async (req, res) => {
  const authHeader = req.headers.authorization;
  const refreshToken = req.body?.refreshToken as string | undefined;

  if (!refreshToken) {
    throw new AppError(400, "TOKEN_REQUIRED", "refreshToken is required in the request body");
  }

  const ipAddress = req.ip ?? "unknown";
  await logout(req.user.userId, refreshToken, ipAddress);

  res.status(200).json({ data: { message: "Logged out successfully" } });
});

/**
 * POST /api/v1/auth/refresh
 * Public — validates refresh token and returns new tokens.
 */
router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    throw new AppError(400, "TOKEN_REQUIRED", "refreshToken is required in the request body");
  }

  const ipAddress = req.ip ?? "unknown";
  const result = await refresh(refreshToken, ipAddress);

  res.status(200).json({ data: result });
});

export default router;
