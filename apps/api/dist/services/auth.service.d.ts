/**
 * In-memory set of revoked refresh tokens.
 * NOTE: Resets on server restart. Replace with a DB table for production.
 */
export declare const revokedRefreshTokens: Set<string>;
export interface LoginResult {
    accessToken: string;
    refreshToken: string;
    isTempPassword: boolean;
}
/**
 * Authenticate an employee by employeeId + password.
 * Returns signed access (15 m) and refresh (7 d) tokens.
 */
export declare function login(employeeId: string, password: string, ipAddress: string): Promise<LoginResult>;
/**
 * Change the authenticated employee's password.
 * Verifies currentPassword, hashes newPassword with bcrypt cost 12,
 * and clears isTempPassword.
 */
export declare function changePassword(userId: string, currentPassword: string, newPassword: string, ipAddress: string): Promise<void>;
/**
 * Logout: revoke the provided refresh token by adding it to the in-memory set.
 */
export declare function logout(userId: string, refreshToken: string, ipAddress: string): Promise<void>;
/**
 * Hash a plain-text password with bcrypt cost factor 12.
 * Exported for use in employee creation (task 8).
 */
export declare function hashPassword(plain: string): Promise<string>;
/**
 * Handle refresh token request
 */
export declare function refresh(oldRefreshToken: string, ipAddress: string): Promise<LoginResult>;
//# sourceMappingURL=auth.service.d.ts.map