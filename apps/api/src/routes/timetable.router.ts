import { Router } from "express";
import { PERMISSIONS } from "@hrms/shared";
import { requirePermission } from "../middleware/rbac.js";
import {
  createEntry,
  updateEntry,
  deleteEntry,
  recordSubstitution,
  getEmployeeTimetable,
} from "../services/timetable.service.js";
import type { ActorContext } from "../services/timetable.service.js";

const router = Router();

function getActor(req: import("express").Request): ActorContext {
  return {
    userId: req.user.userId,
    role: req.user.role,
    ipAddress: req.ip ?? "unknown",
  };
}

// GET /schedule — list all schedule entries
router.get(
  "/schedule",
  requirePermission(PERMISSIONS.SCHEDULE_READ),
  async (_req, res) => {
    const entries = await import("../lib/prisma.js").then((m) =>
      m.prisma.scheduleEntry.findMany({ orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] })
    );
    res.json({ data: entries });
  }
);

// POST /schedule — create a schedule entry
router.post(
  "/schedule",
  requirePermission(PERMISSIONS.SCHEDULE_CREATE),
  async (req, res) => {
    const entry = await createEntry(req.body, getActor(req));
    res.status(201).json({ data: entry });
  }
);

// GET /schedule/:id — get a single schedule entry
router.get(
  "/schedule/:id",
  requirePermission(PERMISSIONS.SCHEDULE_READ),
  async (req, res) => {
    const entry = await import("../lib/prisma.js").then((m) =>
      m.prisma.scheduleEntry.findUnique({ where: { id: req.params.id } })
    );
    if (!entry) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Schedule entry not found" } });
      return;
    }
    res.json({ data: entry });
  }
);

// PUT /schedule/:id — update a schedule entry
router.put(
  "/schedule/:id",
  requirePermission(PERMISSIONS.SCHEDULE_UPDATE),
  async (req, res) => {
    const entry = await updateEntry(req.params.id, req.body, getActor(req));
    res.json({ data: entry });
  }
);

// DELETE /schedule/:id — delete a schedule entry
router.delete(
  "/schedule/:id",
  requirePermission(PERMISSIONS.SCHEDULE_DELETE),
  async (req, res) => {
    await deleteEntry(req.params.id, getActor(req));
    res.status(204).send();
  }
);

// POST /schedule/:id/substitution — record a substitution
router.post(
  "/schedule/:id/substitution",
  requirePermission(PERMISSIONS.SCHEDULE_SUBSTITUTION),
  async (req, res) => {
    const substitution = await recordSubstitution(req.params.id, req.body, getActor(req));
    res.status(201).json({ data: substitution });
  }
);

// GET /employees/:id/timetable — get an employee's full timetable
router.get(
  "/employees/:id/timetable",
  requirePermission(PERMISSIONS.SCHEDULE_READ),
  async (req, res) => {
    const entries = await getEmployeeTimetable(req.params.id);
    res.json({ data: entries });
  }
);

export default router;
