import jwt from "jsonwebtoken";
/**
 * JWT verification middleware.
 * Extracts userId, role, specialPrivilege, campusId, isTempPassword from Bearer token
 * and attaches them to req.user.
 */
export function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({
            error: {
                code: "MISSING_TOKEN",
                message: "Authorization header with Bearer token is required",
            },
        });
        return;
    }
    const token = authHeader.slice(7);
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
        res.status(500).json({
            error: {
                code: "SERVER_MISCONFIGURATION",
                message: "JWT_ACCESS_SECRET is not configured",
            },
        });
        return;
    }
    try {
        const payload = jwt.verify(token, secret);
        req.user = {
            userId: payload.userId,
            role: payload.role,
            specialPrivilege: payload.specialPrivilege,
            campusId: payload.campusId,
            isTempPassword: payload.isTempPassword,
        };
        next();
    }
    catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
            res.status(401).json({
                error: {
                    code: "TOKEN_EXPIRED",
                    message: "Access token has expired",
                },
            });
            return;
        }
        res.status(401).json({
            error: {
                code: "INVALID_TOKEN",
                message: "Access token is invalid",
            },
        });
    }
}
//# sourceMappingURL=auth.js.map