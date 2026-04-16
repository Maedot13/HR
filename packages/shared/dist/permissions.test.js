import { describe, it, expect } from "vitest";
import { computeEffectivePermissions } from "./permissions.js";
import { ROLE_PERMISSIONS, PRIVILEGE_PERMISSIONS, PERMISSIONS } from "./constants.js";
const BASE_ROLES = ["SUPER_ADMIN", "ADMIN", "HR_OFFICER", "EMPLOYEE"];
const PRIVILEGES = [
    "UNIVERSITY_PRESIDENT",
    "VICE_PRESIDENT",
    "DEAN",
    "DIRECTOR",
];
describe("computeEffectivePermissions", () => {
    it("returns only role permissions when no privilege is given", () => {
        for (const role of BASE_ROLES) {
            const result = computeEffectivePermissions(role);
            const expected = ROLE_PERMISSIONS[role];
            expect(result).toEqual(expected);
        }
    });
    it("returns union of role and privilege permissions", () => {
        for (const role of BASE_ROLES) {
            for (const priv of PRIVILEGES) {
                const result = computeEffectivePermissions(role, priv);
                const rolePerms = ROLE_PERMISSIONS[role];
                const privPerms = PRIVILEGE_PERMISSIONS[priv];
                const expected = new Set([...rolePerms, ...privPerms]);
                expect(result).toEqual(expected);
            }
        }
    });
    it("never drops base role permissions when a privilege is added", () => {
        for (const role of BASE_ROLES) {
            for (const priv of PRIVILEGES) {
                const withPriv = computeEffectivePermissions(role, priv);
                const withoutPriv = computeEffectivePermissions(role);
                for (const perm of withoutPriv) {
                    expect(withPriv.has(perm)).toBe(true);
                }
            }
        }
    });
    it("privilege permissions are a subset of effective permissions", () => {
        for (const role of BASE_ROLES) {
            for (const priv of PRIVILEGES) {
                const effective = computeEffectivePermissions(role, priv);
                for (const perm of PRIVILEGE_PERMISSIONS[priv]) {
                    expect(effective.has(perm)).toBe(true);
                }
            }
        }
    });
    it("SUPER_ADMIN has all defined permissions", () => {
        const superAdminPerms = computeEffectivePermissions("SUPER_ADMIN");
        for (const perm of Object.values(PERMISSIONS)) {
            expect(superAdminPerms.has(perm)).toBe(true);
        }
    });
    it("EMPLOYEE with UNIVERSITY_PRESIDENT privilege can approve leave without pay", () => {
        const perms = computeEffectivePermissions("EMPLOYEE", "UNIVERSITY_PRESIDENT");
        expect(perms.has(PERMISSIONS.LEAVE_WITHOUT_PAY_APPROVE)).toBe(true);
        // Still retains base employee permissions
        expect(perms.has(PERMISSIONS.LEAVE_APPLY)).toBe(true);
    });
    it("returns a new Set instance each call (no shared mutable state)", () => {
        const a = computeEffectivePermissions("EMPLOYEE");
        const b = computeEffectivePermissions("EMPLOYEE");
        expect(a).not.toBe(b);
        a.add("fake:perm");
        expect(b.has("fake:perm")).toBe(false);
    });
});
//# sourceMappingURL=permissions.test.js.map