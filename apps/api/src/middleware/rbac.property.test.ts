/**
 * Property 4: Effective Permissions Are the Union of Role and Privilege
 *
 * **Validates: Requirements 3.3, 3.4, 3.6**
 *
 * For any (BaseRole, SpecialPrivilege | undefined) pair:
 *   computeEffectivePermissions(role, priv) === permissions(role) ∪ permissions(priv)
 *
 * Assigning or updating a special privilege must never remove any permission
 * already granted by the base role.
 */
import { describe, it } from "vitest";
import fc from "fast-check";
import { computeEffectivePermissions, ROLE_PERMISSIONS, PRIVILEGE_PERMISSIONS } from "@hrms/shared";
import type { BaseRole, SpecialPrivilege } from "@hrms/shared";

// ── Arbitraries ───────────────────────────────────────────────────────────────

const BASE_ROLES: BaseRole[] = ["SUPER_ADMIN", "ADMIN", "HR_OFFICER", "EMPLOYEE"];
const PRIVILEGES: SpecialPrivilege[] = [
  "UNIVERSITY_PRESIDENT",
  "VICE_PRESIDENT",
  "DEAN",
  "DIRECTOR",
];

const arbBaseRole = fc.constantFrom(...BASE_ROLES);
const arbPrivilege = fc.constantFrom(...PRIVILEGES);
const arbOptionalPrivilege = fc.option(arbPrivilege, { nil: undefined });

// ── Property tests ────────────────────────────────────────────────────────────

describe("Property 4: Effective Permissions Are the Union of Role and Privilege", () => {
  /**
   * Core union property:
   * effective(role, priv) === rolePerms(role) ∪ privPerms(priv)
   */
  it("effective permissions equal the union of role permissions and privilege permissions", () => {
    fc.assert(
      fc.property(arbBaseRole, arbOptionalPrivilege, (role, priv) => {
        const effective = computeEffectivePermissions(role, priv);

        const rolePerms = ROLE_PERMISSIONS[role];
        const privPerms =
          priv !== undefined
            ? PRIVILEGE_PERMISSIONS[priv]
            : new Set<string>();

        const expected = new Set([...rolePerms, ...privPerms]);

        // Same size
        if (effective.size !== expected.size) return false;

        // Every expected permission is present
        for (const perm of expected) {
          if (!effective.has(perm)) return false;
        }

        // No extra permissions beyond the union
        for (const perm of effective) {
          if (!expected.has(perm)) return false;
        }

        return true;
      }),
      { numRuns: 200 }
    );
  });

  /**
   * Base-role permissions are never dropped when a privilege is added.
   * effective(role, priv) ⊇ permissions(role)
   */
  it("adding a special privilege never removes base-role permissions", () => {
    fc.assert(
      fc.property(arbBaseRole, arbPrivilege, (role, priv) => {
        const withPriv = computeEffectivePermissions(role, priv);
        const withoutPriv = computeEffectivePermissions(role);

        for (const perm of withoutPriv) {
          if (!withPriv.has(perm)) return false;
        }

        return true;
      }),
      { numRuns: 200 }
    );
  });

  /**
   * Privilege permissions are always present in the effective set.
   * effective(role, priv) ⊇ permissions(priv)
   */
  it("privilege permissions are always included in the effective set", () => {
    fc.assert(
      fc.property(arbBaseRole, arbPrivilege, (role, priv) => {
        const effective = computeEffectivePermissions(role, priv);
        const privPerms = PRIVILEGE_PERMISSIONS[priv];

        for (const perm of privPerms) {
          if (!effective.has(perm)) return false;
        }

        return true;
      }),
      { numRuns: 200 }
    );
  });

  /**
   * Without a privilege, effective permissions equal exactly the role permissions.
   */
  it("without a privilege, effective permissions equal exactly the role permissions", () => {
    fc.assert(
      fc.property(arbBaseRole, (role) => {
        const effective = computeEffectivePermissions(role, undefined);
        const rolePerms = ROLE_PERMISSIONS[role];

        if (effective.size !== rolePerms.size) return false;

        for (const perm of rolePerms) {
          if (!effective.has(perm)) return false;
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Each call returns a fresh Set — mutations do not affect subsequent calls.
   */
  it("returns a new Set instance each call (no shared mutable state)", () => {
    fc.assert(
      fc.property(arbBaseRole, arbOptionalPrivilege, (role, priv) => {
        const a = computeEffectivePermissions(role, priv);
        const b = computeEffectivePermissions(role, priv);

        if (a === b) return false; // must be distinct references

        const sentinel = "__test_sentinel__";
        a.add(sentinel);
        return !b.has(sentinel);
      }),
      { numRuns: 100 }
    );
  });
});
