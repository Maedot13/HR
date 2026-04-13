import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { logActivity } from "../middleware/activityLogger.js";

const BCRYPT_COST = 12;
const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "7d";

/**
 * In-memory set of revoked refresh tokens.
 * NOTE: Resets on server restart. Replace with a DB table for production.
 */
export const revokedRefreshTokens = new Set<string>();

interface JwtPayload {
  userId: string;
  role: string;
  specialPrivilege?: string;
  campusId: string;
  isTempPassword: boolean;
}

function signAccessToken(payload: JwtPayload): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new AppError(500, "SERVER_MISCONFIGURATION", "JWT_ACCESS_SECRET is not configured");
  return jwt.sign(payload, secret, { expiresIn: ACCESS_TOKEN_TTL });
}

function signRefreshToken(payload: JwtPayload): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new AppError(500, "SERVER_MISCONFIGURATION", "JWT_REFRESH_SECRET is not configured");
  return jwt.sign(payload, secret, { expiresIn: REFRESH_TOKEN_TTL });
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  isTempPassword: boolean;
}

/**
 * Authenticate an employee by employeeId + password.
 * Returns signed access (15 m) and refresh (7 d) tokens.
 */
export async function login(
  employeeId: string,
  password: string,
  ipAddress: string
): Promise<LoginResult> {
  const employee = await prisma.employee.findUnique({
    where: { employeeId },
    include: { UserRole: true },
  });

  if (!employee) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid employee ID or password");
  }

  if (employee.status === "INACTIVE") {
    throw new AppError(403, "ACCOUNT_INACTIVE", "This account has been deactivated");
  }

  const passwordMatch = await bcrypt.compare(password, employee.passwordHash);
  if (!passwordMatch) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid employee ID or password");
  }

  const payload: JwtPayload = {
    userId: employee.id,
    role: employee.UserRole?.baseRole ?? "EMPLOYEE",
    specialPrivilege: employee.UserRole?.specialPrivilege ?? undefined,
    campusId: employee.campusId,
    isTempPassword: employee.isTempPassword,
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await logActivity({
    actingUserId: employee.id,
    actingRole: payload.role,
    actionType: "LOGIN",
    resourceType: "Employee",
    resourceId: employee.id,
    ipAddress,
  });

  return { accessToken, refreshToken, isTempPassword: employee.isTempPassword };
}

/**
 * Change the authenticated employee's password.
 * Verifies currentPassword, hashes newPassword with bcrypt cost 12,
 * and clears isTempPassword.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  ipAddress: string
): Promise<void> {
  const employee = await prisma.employee.findUnique({ where: { id: userId } });

  if (!employee) {
    throw new AppError(404, "NOT_FOUND", "Employee not found");
  }

  const passwordMatch = await bcrypt.compare(currentPassword, employee.passwordHash);
  if (!passwordMatch) {
    throw new AppError(400, "INVALID_CURRENT_PASSWORD", "Current password is incorrect");
  }

  const newHash = await bcrypt.hash(newPassword, BCRYPT_COST);

  await prisma.employee.update({
    where: { id: userId },
    data: {
      passwordHash: newHash,
      isTempPassword: false,
    },
  });

  await logActivity({
    actingUserId: userId,
    actingRole: "EMPLOYEE",
    actionType: "PASSWORD_CHANGED",
    resourceType: "Employee",
    resourceId: userId,
    previousState: { isTempPassword: employee.isTempPassword },
    newState: { isTempPassword: false },
    ipAddress,
  });
}

/**
 * Logout: revoke the provided refresh token by adding it to the in-memory set.
 */
export async function logout(
  userId: string,
  refreshToken: string,
  ipAddress: string
): Promise<void> {
  revokedRefreshTokens.add(refreshToken);

  await logActivity({
    actingUserId: userId,
    actingRole: "EMPLOYEE",
    actionType: "LOGOUT",
    resourceType: "Employee",
    resourceId: userId,
    ipAddress,
  });
}

/**
 * Hash a plain-text password with bcrypt cost factor 12.
 * Exported for use in employee creation (task 8).
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

/**
 * Handle refresh token request
 */
export async function refresh(
  oldRefreshToken: string,
  ipAddress: string
): Promise<LoginResult> {
  if (revokedRefreshTokens.has(oldRefreshToken)) {
    throw new AppError(401, "INVALID_TOKEN", "Refresh token has been revoked");
  }

  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new AppError(500, "SERVER_MISCONFIGURATION", "JWT_REFRESH_SECRET is not configured");

  let payload: JwtPayload;
  try {
    payload = jwt.verify(oldRefreshToken, secret) as JwtPayload;
  } catch (err) {
    throw new AppError(401, "INVALID_TOKEN", "Invalid or expired refresh token");
  }

  const employee = await prisma.employee.findUnique({
    where: { id: payload.userId },
    include: { UserRole: true },
  });

  if (!employee) throw new AppError(401, "INVALID_TOKEN", "User no longer exists");
  if (employee.status === "INACTIVE") throw new AppError(403, "ACCOUNT_INACTIVE", "Account deactivated");

  const newPayload: JwtPayload = {
    userId: employee.id,
    role: employee.UserRole?.baseRole ?? "EMPLOYEE",
    specialPrivilege: employee.UserRole?.specialPrivilege ?? undefined,
    campusId: employee.campusId,
    isTempPassword: employee.isTempPassword,
  };

  const accessToken = signAccessToken(newPayload);
  const refreshToken = signRefreshToken(newPayload);

  // Revoke the old refresh token
  revokedRefreshTokens.add(oldRefreshToken);

  await logActivity({
    actingUserId: employee.id,
    actingRole: newPayload.role,
    actionType: "TOKEN_REFRESH",
    resourceType: "Employee",
    resourceId: employee.id,
    ipAddress,
  });

  return { accessToken, refreshToken, isTempPassword: employee.isTempPassword };
}

