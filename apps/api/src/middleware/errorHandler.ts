import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";

/**
 * Application-level error class for structured API errors.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handler middleware.
 * Returns errors in the { error: { code, message, details } } envelope.
 * Must be registered LAST in the Express middleware chain.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // 1. Log the raw error internally — dev only to avoid production stdout noise
  if (process.env.NODE_ENV !== "production") {
    console.error(`[ErrorHandler] ${req.method} ${req.url} - Error:`, err);
  }

  // 2. Handle Expected Operational Errors (AppError)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message, // AppErrors inherently have safe messages
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }

  // 3. Handle Validation Errors (Zod)
  // SECURITY (Rule 6): Strip internal Zod fields (received, expected, code, minimum,
  // type, inclusive, exact) — only expose path + message to avoid leaking schema structure.
  // Migration note: details shape changed from raw ZodIssue[] to { path, message }[].
  // Confirmed zero frontend consumers of stripped fields before applying (Option A, in-place).
  if (
    err instanceof Error &&
    err.name === "ZodError" &&
    "issues" in err
  ) {
    type ZodIssue = { path: (string | number)[]; message: string };
    const rawIssues = (err as { issues: ZodIssue[] }).issues;
    res.status(422).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Some fields have invalid values. Please review the highlighted fields and try again.",
        details: rawIssues.map((i) => ({ path: i.path, message: i.message })),
      },
    });
    return;
  }

  // 4. Handle Database Errors (Prisma)
  // Safely translate DB errors to avoid leaking table/column details
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "This record already exists. Please check for duplicates and try again.",
        },
      });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "The record you requested could not be found. It may have been deleted or never existed.",
        },
      });
      return;
    }
  }

  if (
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientKnownRequestError ||
    err instanceof Prisma.PrismaClientUnknownRequestError ||
    err instanceof Prisma.PrismaClientRustPanicError ||
    err instanceof Prisma.PrismaClientValidationError
  ) {
    res.status(500).json({
      error: {
        code: "DATABASE_ERROR",
        message: "The system could not reach the database. Please wait a moment and try again. If the problem continues, contact your system administrator.",
      },
    });
    return;
  }

  // 5. Handle Network/External API errors (Axios)
  if (err instanceof Error && "isAxiosError" in err) {
    res.status(503).json({
      error: {
        code: "EXTERNAL_API_FAILURE",
        message: "One of the connected services is currently unavailable. Please try again in a few minutes.",
      },
    });
    return;
  }

  // 6. Handle Unexpected / Unknown Errors
  // Overwrite the message to ensure safety in all environments
  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Something went wrong on our end. Please try again. If the problem persists, contact your system administrator.",
    },
  });
}
