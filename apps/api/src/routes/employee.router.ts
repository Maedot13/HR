import { Router } from "express";
import { PERMISSIONS } from "@hrms/shared";
import { requirePermission } from "../middleware/rbac.js";
import { AppError } from "../middleware/errorHandler.js";
import {
  createEmployee,
  getEmployee,
  listEmployees,
  updateEmployee,
  activateEmployee,
  uploadDocument,
  listDocuments,
  getEmploymentHistory,
  assignRole,
  assignPrivilege,
  getPermissions,
} from "../services/employee.service.js";
import type { ActorContext } from "../services/employee.service.js";
import type { BaseRole, SpecialPrivilege } from "@hrms/shared";

const router = Router();

function getActor(req: import("express").Request): ActorContext {
  return {
    userId: req.user.userId,
    role: req.user.role,
    campusId: req.user.campusId,
    ipAddress: req.ip ?? "unknown",
  };
}

// ─── List / Create employees ──────────────────────────────────────────────────

router.get(
  "/employees",
  requirePermission(PERMISSIONS.EMPLOYEE_READ),
  async (req, res) => {
    const { campusId, status, search } = req.query as Record<string, string | undefined>;
    const employees = await listEmployees({ campusId, status, search });
    res.json({ data: employees });
  }
);

router.post(
  "/employees",
  requirePermission(PERMISSIONS.EMPLOYEE_CREATE),
  async (req, res) => {
    const body = req.body as Record<string, unknown>;
    if (!body.campusId) {
      throw new AppError(422, "VALIDATION_ERROR", "campusId is required");
    }
    const result = await createEmployee(body as unknown as Parameters<typeof createEmployee>[0], getActor(req));
    res.status(201).json({ data: result });
  }
);

// ─── Get / Update single employee ─────────────────────────────────────────────

router.get(
  "/employees/:id",
  requirePermission(PERMISSIONS.EMPLOYEE_READ),
  async (req, res) => {
    const employee = await getEmployee(req.params.id);
    res.json({ data: employee });
  }
);

router.put(
  "/employees/:id",
  requirePermission(PERMISSIONS.EMPLOYEE_UPDATE),
  async (req, res) => {
    const employee = await updateEmployee(
      req.params.id,
      req.body as Parameters<typeof updateEmployee>[1],
      getActor(req)
    );
    res.json({ data: employee });
  }
);

// ─── Activate employee ────────────────────────────────────────────────────────

router.post(
  "/employees/:id/activate",
  requirePermission(PERMISSIONS.EMPLOYEE_ACTIVATE),
  async (req, res) => {
    const employee = await activateEmployee(req.params.id, getActor(req));
    res.json({ data: employee });
  }
);

// ─── Documents ────────────────────────────────────────────────────────────────

router.get(
  "/employees/:id/documents",
  requirePermission(PERMISSIONS.EMPLOYEE_READ),
  async (req, res) => {
    const docs = await listDocuments(req.params.id);
    res.json({ data: docs });
  }
);

router.post(
  "/employees/:id/documents",
  requirePermission(PERMISSIONS.EMPLOYEE_DOCUMENT_UPLOAD),
  async (req, res) => {
    const { documentType, fileUrl } = req.body as {
      documentType?: string;
      fileUrl?: string;
    };
    if (!documentType || !fileUrl) {
      throw new AppError(422, "VALIDATION_ERROR", "documentType and fileUrl are required");
    }
    const doc = await uploadDocument(req.params.id, documentType, fileUrl, getActor(req));
    res.status(201).json({ data: doc });
  }
);

// ─── Employment history ───────────────────────────────────────────────────────

router.get(
  "/employees/:id/history",
  requirePermission(PERMISSIONS.EMPLOYEE_READ),
  async (req, res) => {
    const history = await getEmploymentHistory(req.params.id);
    res.json({ data: history });
  }
);

// ─── Role assignment ──────────────────────────────────────────────────────────

router.put(
  "/employees/:id/role",
  requirePermission(PERMISSIONS.EMPLOYEE_ROLE_ASSIGN),
  async (req, res) => {
    const { baseRole } = req.body as { baseRole?: string };
    if (!baseRole) {
      throw new AppError(422, "VALIDATION_ERROR", "baseRole is required");
    }
    const userRole = await assignRole(req.params.id, baseRole as BaseRole, getActor(req));
    res.json({ data: userRole });
  }
);

// ─── Privilege assignment ─────────────────────────────────────────────────────

router.put(
  "/employees/:id/privilege",
  requirePermission(PERMISSIONS.EMPLOYEE_PRIVILEGE_ASSIGN),
  async (req, res) => {
    const { specialPrivilege } = req.body as { specialPrivilege?: string | null };
    const userRole = await assignPrivilege(
      req.params.id,
      (specialPrivilege as SpecialPrivilege | null) ?? null,
      getActor(req)
    );
    res.json({ data: userRole });
  }
);

// ─── Permissions ──────────────────────────────────────────────────────────────

router.get(
  "/employees/:id/permissions",
  requirePermission(PERMISSIONS.EMPLOYEE_READ),
  async (req, res) => {
    const permissions = await getPermissions(req.params.id);
    res.json({ data: permissions });
  }
);

export default router;
