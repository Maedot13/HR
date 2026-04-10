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
  // 1. Log the raw error internally for visibility & debugging
  console.error(`[ErrorHandler] ${req.method} ${req.url} - Error:`, err);

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
  if (
    err instanceof Error &&
    err.name === "ZodError" &&
    "issues" in err
  ) {
    res.status(422).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid input provided. Please check the data and try again.",
        details: (err as { issues: unknown }).issues,
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
          message: "A record with this specific data already exists.",
        },
      });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "The requested record was not found.",
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
        message: "Database service temporarily unavailable.",
      },
    });
    return;
  }

  // 5. Handle Network/External API errors (Axios)
  if (err instanceof Error && "isAxiosError" in err) {
    res.status(503).json({
      error: {
        code: "EXTERNAL_API_FAILURE",
        message: "Failed to communicate with an external service. Please try again later.",
      },
    });
    return;
  }

  // 6. Handle Unexpected / Unknown Errors
  // Overwrite the message to ensure safety in all environments
  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred. Please try again later.",
    },
  });
}
