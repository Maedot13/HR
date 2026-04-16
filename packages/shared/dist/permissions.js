import { ROLE_PERMISSIONS, PRIVILEGE_PERMISSIONS } from "./constants.js";
/**
 * Computes the effective permission set for a user.
 *
 * The effective permissions are the UNION of:
 *   - All permissions granted by the user's base role
 *   - All permissions granted by the user's special privilege (if any)
 *
 * Assigning or updating a special privilege never removes base role permissions.
 *
 * @param role - The user's base role
 * @param privilege - The user's optional special privilege
 * @returns A Set<string> of permission codes the user is allowed to exercise
 *
 * @example
 * const perms = computeEffectivePermissions("EMPLOYEE", "UNIVERSITY_PRESIDENT");
 * perms.has("leave:without_pay:approve"); // true (from privilege)
 * perms.has("leave:apply");               // true (from base role)
 */
export function computeEffectivePermissions(role, privilege) {
    const rolePerms = ROLE_PERMISSIONS[role] ?? new Set();
    const privPerms = privilege != null
        ? (PRIVILEGE_PERMISSIONS[privilege] ?? new Set())
        : new Set();
    return new Set([...rolePerms, ...privPerms]);
}
//# sourceMappingURL=permissions.js.map