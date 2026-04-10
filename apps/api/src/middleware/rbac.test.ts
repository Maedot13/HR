/**
 * Property 5: Unauthorized Actions Return HTTP 403
 *
 * **Validates: Requirements 3.7, 3.8**
 *
 * For any permission-protected action requiring permission code C,
 * and any user whose effective permission set does not contain C,
 * the system must return HTTP 403 and deny the action.
 */
import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import type { Request, Response, NextFunction } from "express";
import { requirePermission } from "./rbac.js";
import {
  computeEffectivePermissions,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  PRIVILEGE_PERMISSIONS,
} from "@hrms/shared";
import type { BaseRole, SpecialPrivilege } from "@hrms/shared";

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE_ROLES: BaseRole[] = ["SUPER_ADMIN", "ADMIN", "HR_OFFICER", "EMPLOYEE"];
const PRIVILEGES: SpecialPrivilege[] = [
  "UNIVERSITY_PRESIDENT",
  "VICE_PRESIDENT",
  "DEAN",
  "DIRECTOR",
];
const ALL_PERMISSIONS = Object.values(PERMISSIONS);

function makeReq(role: BaseRole, specialPrivilege?: SpecialPrivilege): Partial<Request> {
  return {
    user: {
      userId: "user-1",
      role,
      specialPrivilege,
      campusId: "campus-1",
      isTempPassword: false,
    } as Request["user"],
  };
}

interface ResCtx {
  statusCode: number | null;
  body: unknown;
}

function makeRes(): { res: Partial<Response>; ctx: ResCtx } {
  const ctx: ResCtx = { statusCode: null, body: null };
  const res: Partial<Response> = {
    status(code: number) {
      ctx.statusCode = code;
      return this as Response;
    },
    json(data: unknown) {
      ctx.body = data;
      return this as Response;
    },
  };
  return { res, ctx };
}

// ── Unit tests ────────────────────────────────────────────────────────────────

describe("requirePermission middleware", () => {
  it("calls next() when the user has the required permission", () => {
    // SUPER_ADMIN has all permissions
    const req = makeReq("SUPER_ADMIN");
    const { res, ctx } = makeRes();
    const next = vi.fn();

    requirePermission(PERMISSIONS.EMPLOYEE_READ)(
      req as Request,
      res as Response,
      next as NextFunction
    );

    expect(next).toHaveBeenCalledOnce();
    expect(ctx.statusCode).toBeNull();
  });

  it("returns 403 FORBIDDEN when the user lacks the required permission", () => {
    // EMPLOYEE does not have PAYROLL_GENERATE
    const req = makeReq("EMPLOYEE");
    const { res, ctx } = makeRes();
    const next = vi.fn();

    requirePermission(PERMISSIONS.PAYROLL_GENERATE)(
      req as Request,
      res as Response,
      next as NextFunction
    );

    expect(next).not.toHaveBeenCalled();
    expect(ctx.statusCode).toBe(403);
    expect((ctx.body as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("grants access when a special privilege adds the required permission", () => {
    // EMPLOYEE normally cannot approve leave without pay, but UNIVERSITY_PRESIDENT privilege grants it
    const req = makeReq("EMPLOYEE", "UNIVERSITY_PRESIDENT");
    const { res, ctx } = makeRes();
    const next = vi.fn();

    requirePermission(PERMISSIONS.LEAVE_WITHOUT_PAY_APPROVE)(
      req as Request,
      res as Response,
      next as NextFunction
    );

    expect(next).toHaveBeenCalledOnce();
    expect(ctx.statusCode).toBeNull();
  });

  it("returns 403 with the global error envelope format", () => {
    const req = makeReq("EMPLOYEE");
    const { res, ctx } = makeRes();
    const next = vi.fn();

    requirePermission(PERMISSIONS.PAYROLL_GENERATE)(
      req as Request,
      res as Response,
      next as NextFunction
    );

    const body = ctx.body as { error: { code: string; message: string } };
    expect(body).toHaveProperty("error");
    expect(body.error).toHaveProperty("code", "FORBIDDEN");
    expect(body.error).toHaveProperty("message");
    expect(typeof body.error.message).toBe("string");
  });

  it("does not call next() when 403 is returned", () => {
    const req = makeReq("EMPLOYEE");
    const { res, ctx } = makeRes();
    const next = vi.fn();

    requirePermission(PERMISSIONS.CAMPUS_DELETE)(
      req as Request,
      res as Response,
      next as NextFunction
    );

    expect(next).not.toHaveBeenCalled();
    expect(ctx.statusCode).toBe(403);
  });
});

// ── Property tests ────────────────────────────────────────────────────────────

const arbBaseRole = fc.constantFrom(...BASE_ROLES);
const arbPrivilege = fc.constantFrom(...PRIVILEGES);
const arbOptionalPrivilege = fc.option(arbPrivilege, { nil: undefined });
const arbPermission = fc.constantFrom(...ALL_PERMISSIONS);

describe("Property 5: Unauthorized Actions Return HTTP 403", () => {
  /**
   * Core property: if the user's effective set lacks permission C,
   * requirePermission(C) must return 403 FORBIDDEN and not call next().
   */
  it("returns 403 FORBIDDEN for any user whose effective set lacks the required permission", () => {
    fc.assert(
      fc.property(
        arbBaseRole,
        arbOptionalPrivilege,
        arbPermission,
        (role, priv, permission) => {
          const effective = computeEffectivePermissions(role, priv);

          // Only test cases where the user lacks the permission
          if (effective.has(permission)) return true; // skip — not the scenario under test

          const req = makeReq(role, priv);
          let capturedStatus: number | null = null;
          let capturedBody: unknown = null;

          const res: Partial<Response> = {
            status(code: number) {
              capturedStatus = code;
              return this as Response;
            },
            json(data: unknown) {
              capturedBody = data;
              return this as Response;
            },
          };
          const next = vi.fn();

          requirePermission(permission)(
            req as Request,
            res as Response,
            next as NextFunction
          );

          const is403 = capturedStatus === 403;
          const hasForbiddenCode =
            (capturedBody as { error?: { code?: string } })?.error?.code === "FORBIDDEN";
          const nextNotCalled = next.mock.calls.length === 0;

          return is403 && hasForbiddenCode && nextNotCalled;
        }
      ),
      { numRuns: 300 }
    );
  });

  /**
   * Inverse property: if the user's effective set contains permission C,
   * requirePermission(C) must call next() and not return 403.
   */
  it("calls next() for any user whose effective set contains the required permission", () => {
    fc.assert(
      fc.property(
        arbBaseRole,
        arbOptionalPrivilege,
        arbPermission,
        (role, priv, permission) => {
          const effective = computeEffectivePermissions(role, priv);

          // Only test cases where the user has the permission
          if (!effective.has(permission)) return true; // skip — not the scenario under test

          const req = makeReq(role, priv);
          let capturedStatus: number | null = null;

          const res: Partial<Response> = {
            status(code: number) {
              capturedStatus = code;
              return this as Response;
            },
            json() {
              return this as Response;
            },
          };
          const next = vi.fn();

          requirePermission(permission)(
            req as Request,
            res as Response,
            next as NextFunction
          );

          return next.mock.calls.length === 1 && capturedStatus === null;
        }
      ),
      { numRuns: 300 }
    );
  });

  /**
   * Special privilege grant property:
   * If a privilege adds permission C to a role that otherwise lacks it,
   * the user with that privilege must be granted access (not 403).
   */
  it("grants access when a special privilege adds the missing permission", () => {
    fc.assert(
      fc.property(arbBaseRole, arbPrivilege, (role, priv) => {
        const withoutPriv = computeEffectivePermissions(role);
        const withPriv = computeEffectivePermissions(role, priv);

        // Find a permission that the privilege adds (not in base role)
        const addedByPriv = [...withPriv].filter((p) => !withoutPriv.has(p));

        // If this privilege adds no new permissions for this role, skip
        if (addedByPriv.length === 0) return true;

        const permission = addedByPriv[0];
        const req = makeReq(role, priv);
        let capturedStatus: number | null = null;

        const res: Partial<Response> = {
          status(code: number) {
            capturedStatus = code;
            return this as Response;
          },
          json() {
            return this as Response;
          },
        };
        const next = vi.fn();

        requirePermission(permission)(
          req as Request,
          res as Response,
          next as NextFunction
        );

        return next.mock.calls.length === 1 && capturedStatus === null;
      }),
      { numRuns: 200 }
    );
  });

  /**
   * 403 response always uses the global error envelope:
   * { error: { code: "FORBIDDEN", message: string } }
   */
  it("403 response always uses the global error envelope format", () => {
    fc.assert(
      fc.property(
        arbBaseRole,
        arbOptionalPrivilege,
        arbPermission,
        (role, priv, permission) => {
          const effective = computeEffectivePermissions(role, priv);
          if (effective.has(permission)) return true; // skip

          const req = makeReq(role, priv);
          let capturedBody: unknown = null;

          const res: Partial<Response> = {
            status() {
              return this as Response;
            },
            json(data: unknown) {
              capturedBody = data;
              return this as Response;
            },
          };
          const next = vi.fn();

          requirePermission(permission)(
            req as Request,
            res as Response,
            next as NextFunction
          );

          const body = capturedBody as { error?: { code?: string; message?: string } };
          return (
            typeof body === "object" &&
            body !== null &&
            typeof body.error === "object" &&
            body.error !== null &&
            body.error.code === "FORBIDDEN" &&
            typeof body.error.message === "string"
          );
        }
      ),
      { numRuns: 300 }
    );
  });
});
