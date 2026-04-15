/**
 * Integration Test: JWT Authentication Flow
 * Validates: Requirements 5.1, 5.2, 3.7
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
process.env.JWT_ACCESS_SECRET = "test-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
const mockPrisma = vi.hoisted(() => ({
    employee: { findUnique: vi.fn() },
    activityLog: { create: vi.fn() },
}));
vi.mock("../lib/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../middleware/activityLogger.js", () => ({ logActivity: vi.fn() }));
import { login, logout, revokedRefreshTokens } from "../services/auth.service.js";
const PLAIN_PASSWORD = "SecurePass123!";
const EMPLOYEE_ID = "emp-1";
async function makeEmployee(overrides = {}) {
    const passwordHash = await bcrypt.hash(PLAIN_PASSWORD, 12);
    return { id: EMPLOYEE_ID, employeeId: "BDU-2026-00001", fullName: "Test User", status: "ACTIVE", campusId: "campus-1", isTempPassword: false, passwordHash, userRole: { baseRole: "HR_OFFICER", specialPrivilege: null }, ...overrides };
}
describe("Integration: JWT Authentication Flow", () => {
    beforeEach(() => { vi.clearAllMocks(); revokedRefreshTokens.clear(); });
    it("login returns accessToken and refreshToken", async () => {
        mockPrisma.employee.findUnique.mockResolvedValueOnce(await makeEmployee());
        const result = await login("BDU-2026-00001", PLAIN_PASSWORD, "127.0.0.1");
        expect(result.accessToken).toBeDefined();
        expect(result.refreshToken).toBeDefined();
    });
    it("accessToken has correct JWT claims", async () => {
        mockPrisma.employee.findUnique.mockResolvedValueOnce(await makeEmployee());
        const { accessToken } = await login("BDU-2026-00001", PLAIN_PASSWORD, "127.0.0.1");
        const decoded = jwt.verify(accessToken, "test-secret");
        expect(decoded.userId).toBe(EMPLOYEE_ID);
        expect(decoded.role).toBe("HR_OFFICER");
        expect(decoded.campusId).toBe("campus-1");
        expect(decoded.isTempPassword).toBe(false);
    });
    it("isTempPassword flag is reflected in token", async () => {
        mockPrisma.employee.findUnique.mockResolvedValueOnce(await makeEmployee({ isTempPassword: true }));
        const { accessToken, isTempPassword } = await login("BDU-2026-00001", PLAIN_PASSWORD, "127.0.0.1");
        expect(isTempPassword).toBe(true);
        const decoded = jwt.verify(accessToken, "test-secret");
        expect(decoded.isTempPassword).toBe(true);
    });
    it("logout adds refresh token to revoked set", async () => {
        mockPrisma.employee.findUnique.mockResolvedValueOnce(await makeEmployee());
        const { refreshToken } = await login("BDU-2026-00001", PLAIN_PASSWORD, "127.0.0.1");
        expect(revokedRefreshTokens.has(refreshToken)).toBe(false);
        await logout(EMPLOYEE_ID, refreshToken, "127.0.0.1");
        expect(revokedRefreshTokens.has(refreshToken)).toBe(true);
    });
    it("login fails with INVALID_CREDENTIALS for wrong password", async () => {
        mockPrisma.employee.findUnique.mockResolvedValueOnce(await makeEmployee());
        await expect(login("BDU-2026-00001", "WrongPass!", "127.0.0.1")).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    });
    it("login fails with ACCOUNT_INACTIVE for inactive employee", async () => {
        mockPrisma.employee.findUnique.mockResolvedValueOnce(await makeEmployee({ status: "INACTIVE" }));
        await expect(login("BDU-2026-00001", PLAIN_PASSWORD, "127.0.0.1")).rejects.toMatchObject({ code: "ACCOUNT_INACTIVE" });
    });
    it("full flow: login → verify token → logout → token revoked", async () => {
        mockPrisma.employee.findUnique.mockResolvedValueOnce(await makeEmployee());
        const { accessToken, refreshToken, isTempPassword } = await login("BDU-2026-00001", PLAIN_PASSWORD, "127.0.0.1");
        expect(isTempPassword).toBe(false);
        const decoded = jwt.verify(accessToken, "test-secret");
        expect(decoded.userId).toBe(EMPLOYEE_ID);
        expect(revokedRefreshTokens.has(refreshToken)).toBe(false);
        await logout(EMPLOYEE_ID, refreshToken, "127.0.0.1");
        expect(revokedRefreshTokens.has(refreshToken)).toBe(true);
    });
});
//# sourceMappingURL=auth.integration.test.js.map