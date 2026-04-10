/**
 * Property 7: First-Login Password Change Enforcement
 *
 * Validates: Requirements 5.2
 *
 * Property: For any request from a user with isTempPassword = true,
 * every endpoint EXCEPT POST /auth/change-password must return
 * HTTP 403 with code PASSWORD_CHANGE_REQUIRED.
 */
import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import type { Request, Response, NextFunction } from "express";
import { enforcePasswordChange } from "./firstLogin.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(
  method: string,
  path: string,
  isTempPassword: boolean
): Partial<Request> {
  return {
    method,
    path,
    user: {
      userId: "user-1",
      role: "EMPLOYEE",
      campusId: "campus-1",
      isTempPassword,
    } as Request["user"],
  };
}

function makeRes(): { res: Partial<Response>; ctx: { statusCode: number | null; body: unknown } } {
  const ctx: { statusCode: number | null; body: unknown } = {
    statusCode: null,
    body: null,
  };
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

describe("enforcePasswordChange middleware", () => {
  it("allows POST /auth/change-password through even with isTempPassword=true", () => {
    const req = makeReq("POST", "/auth/change-password", true);
    const { res, ctx } = makeRes();
    const next = vi.fn();

    enforcePasswordChange(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
    expect(ctx.statusCode).toBeNull();
  });

  it("blocks any other route when isTempPassword=true with 403 PASSWORD_CHANGE_REQUIRED", () => {
    const req = makeReq("GET", "/employees", true);
    const { res, ctx } = makeRes();
    const next = vi.fn();

    enforcePasswordChange(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.statusCode).toBe(403);
    expect((ctx.body as { error: { code: string } }).error.code).toBe(
      "PASSWORD_CHANGE_REQUIRED"
    );
  });

  it("allows any route when isTempPassword=false", () => {
    const req = makeReq("GET", "/employees", false);
    const { res, ctx } = makeRes();
    const next = vi.fn();

    enforcePasswordChange(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
    expect(ctx.statusCode).toBeNull();
  });
});

// ── Property test ─────────────────────────────────────────────────────────────

/**
 * **Validates: Requirements 5.2**
 *
 * Property 7: First-Login Password Change Enforcement
 *
 * For any HTTP method and path that is NOT (POST, /auth/change-password),
 * a user with isTempPassword=true must always receive 403 PASSWORD_CHANGE_REQUIRED.
 */
describe("Property 7: First-Login Password Change Enforcement", () => {
  const httpMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"];

  it("always returns 403 PASSWORD_CHANGE_REQUIRED for temp-password users on non-change-password routes", () => {
    fc.assert(
      fc.property(
        // Generate arbitrary method + path combinations
        fc.constantFrom(...httpMethods),
        fc.webPath(),
        (method, path) => {
          // Skip the one allowed exception
          if (method === "POST" && path === "/auth/change-password") return true;

          const req = makeReq(method, path, true);
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

          enforcePasswordChange(req as Request, res as Response, next as NextFunction);

          const blocked = capturedStatus === 403 &&
            (capturedBody as { error: { code: string } })?.error?.code ===
              "PASSWORD_CHANGE_REQUIRED" &&
            !next.mock.calls.length;

          return blocked;
        }
      ),
      { numRuns: 200 }
    );
  });

  it("always calls next() for users with isTempPassword=false regardless of route", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...httpMethods),
        fc.webPath(),
        (method, path) => {
          const req = makeReq(method, path, false);
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

          enforcePasswordChange(req as Request, res as Response, next as NextFunction);

          return next.mock.calls.length === 1 && capturedStatus === null;
        }
      ),
      { numRuns: 200 }
    );
  });

  it("always allows POST /auth/change-password through regardless of isTempPassword", () => {
    fc.assert(
      fc.property(fc.boolean(), (isTempPassword) => {
        const req = makeReq("POST", "/auth/change-password", isTempPassword);
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

        enforcePasswordChange(req as Request, res as Response, next as NextFunction);

        return next.mock.calls.length === 1 && capturedStatus === null;
      }),
      { numRuns: 100 }
    );
  });
});
