import type { Request, Response, NextFunction } from "express";
/**
 * Application-level error class for structured API errors.
 */
export declare class AppError extends Error {
    readonly statusCode: number;
    readonly code: string;
    readonly details?: unknown | undefined;
    constructor(statusCode: number, code: string, message: string, details?: unknown | undefined);
}
/**
 * Global error handler middleware.
 * Returns errors in the { error: { code, message, details } } envelope.
 * Must be registered LAST in the Express middleware chain.
 */
export declare function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void;
//# sourceMappingURL=errorHandler.d.ts.map