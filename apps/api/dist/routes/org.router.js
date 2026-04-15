import { Router } from "express";
import { PERMISSIONS } from "@hrms/shared";
import { requirePermission } from "../middleware/rbac.js";
import { AppError } from "../middleware/errorHandler.js";
import { createCampus, listCampuses, getCampusById, updateCampus, deleteCampus, createCollege, listColleges, getCollegeById, updateCollege, deleteCollege, createDepartment, listDepartments, getDepartmentById, updateDepartment, deleteDepartment, createUnit, listUnits, getUnitById, updateUnit, deleteUnit, } from "../services/org.service.js";
const router = Router();
function getActor(req) {
    return {
        userId: req.user.userId,
        role: req.user.role,
        campusId: req.user.campusId,
        ipAddress: req.ip ?? "unknown",
    };
}
// ─── Campuses ─────────────────────────────────────────────────────────────────
router.get("/campuses", requirePermission(PERMISSIONS.CAMPUS_READ), async (_req, res) => {
    const campuses = await listCampuses();
    res.json({ data: campuses });
});
router.post("/campuses", requirePermission(PERMISSIONS.CAMPUS_CREATE), async (req, res) => {
    const { code, name } = req.body;
    if (!code || !name) {
        throw new AppError(422, "VALIDATION_ERROR", "code and name are required");
    }
    const campus = await createCampus(code, name, getActor(req));
    res.status(201).json({ data: campus });
});
router.get("/campuses/:id", requirePermission(PERMISSIONS.CAMPUS_READ), async (req, res) => {
    const campus = await getCampusById(req.params.id);
    res.json({ data: campus });
});
router.put("/campuses/:id", requirePermission(PERMISSIONS.CAMPUS_UPDATE), async (req, res) => {
    const campus = await updateCampus(req.params.id, req.body, getActor(req));
    res.json({ data: campus });
});
router.delete("/campuses/:id", requirePermission(PERMISSIONS.CAMPUS_DELETE), async (req, res) => {
    await deleteCampus(req.params.id, getActor(req));
    res.status(204).send();
});
// ─── Colleges (nested under campus) ──────────────────────────────────────────
router.get("/campuses/:id/colleges", requirePermission(PERMISSIONS.COLLEGE_READ), async (req, res) => {
    const colleges = await listColleges(req.params.id);
    res.json({ data: colleges });
});
router.post("/campuses/:id/colleges", requirePermission(PERMISSIONS.COLLEGE_CREATE), async (req, res) => {
    const { name } = req.body;
    if (!name) {
        throw new AppError(422, "VALIDATION_ERROR", "name is required");
    }
    const college = await createCollege(name, req.params.id, getActor(req));
    res.status(201).json({ data: college });
});
// ─── Colleges (standalone) ────────────────────────────────────────────────────
router.get("/colleges/:id", requirePermission(PERMISSIONS.COLLEGE_READ), async (req, res) => {
    const college = await getCollegeById(req.params.id);
    res.json({ data: college });
});
router.put("/colleges/:id", requirePermission(PERMISSIONS.COLLEGE_UPDATE), async (req, res) => {
    const { name } = req.body;
    if (!name) {
        throw new AppError(422, "VALIDATION_ERROR", "name is required");
    }
    const college = await updateCollege(req.params.id, name, getActor(req));
    res.json({ data: college });
});
router.delete("/colleges/:id", requirePermission(PERMISSIONS.COLLEGE_DELETE), async (req, res) => {
    await deleteCollege(req.params.id, getActor(req));
    res.status(204).send();
});
// ─── Departments (nested under college) ──────────────────────────────────────
router.get("/colleges/:id/departments", requirePermission(PERMISSIONS.DEPARTMENT_READ), async (req, res) => {
    const departments = await listDepartments(req.params.id);
    res.json({ data: departments });
});
router.post("/colleges/:id/departments", requirePermission(PERMISSIONS.DEPARTMENT_CREATE), async (req, res) => {
    const { name } = req.body;
    if (!name) {
        throw new AppError(422, "VALIDATION_ERROR", "name is required");
    }
    const department = await createDepartment(name, req.params.id, getActor(req));
    res.status(201).json({ data: department });
});
// ─── Departments (standalone) ─────────────────────────────────────────────────
router.get("/departments/:id", requirePermission(PERMISSIONS.DEPARTMENT_READ), async (req, res) => {
    const department = await getDepartmentById(req.params.id);
    res.json({ data: department });
});
router.put("/departments/:id", requirePermission(PERMISSIONS.DEPARTMENT_UPDATE), async (req, res) => {
    const { name } = req.body;
    if (!name) {
        throw new AppError(422, "VALIDATION_ERROR", "name is required");
    }
    const department = await updateDepartment(req.params.id, name, getActor(req));
    res.json({ data: department });
});
router.delete("/departments/:id", requirePermission(PERMISSIONS.DEPARTMENT_DELETE), async (req, res) => {
    await deleteDepartment(req.params.id, getActor(req));
    res.status(204).send();
});
// ─── Units (nested under department) ─────────────────────────────────────────
router.get("/departments/:id/units", requirePermission(PERMISSIONS.UNIT_READ), async (req, res) => {
    const units = await listUnits(req.params.id);
    res.json({ data: units });
});
router.post("/departments/:id/units", requirePermission(PERMISSIONS.UNIT_CREATE), async (req, res) => {
    const { name } = req.body;
    if (!name) {
        throw new AppError(422, "VALIDATION_ERROR", "name is required");
    }
    const unit = await createUnit(name, req.params.id, getActor(req));
    res.status(201).json({ data: unit });
});
// ─── Units (standalone) ───────────────────────────────────────────────────────
router.get("/units/:id", requirePermission(PERMISSIONS.UNIT_READ), async (req, res) => {
    const unit = await getUnitById(req.params.id);
    res.json({ data: unit });
});
router.put("/units/:id", requirePermission(PERMISSIONS.UNIT_UPDATE), async (req, res) => {
    const { name } = req.body;
    if (!name) {
        throw new AppError(422, "VALIDATION_ERROR", "name is required");
    }
    const unit = await updateUnit(req.params.id, name, getActor(req));
    res.json({ data: unit });
});
router.delete("/units/:id", requirePermission(PERMISSIONS.UNIT_DELETE), async (req, res) => {
    await deleteUnit(req.params.id, getActor(req));
    res.status(204).send();
});
export default router;
//# sourceMappingURL=org.router.js.map