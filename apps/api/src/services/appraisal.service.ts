import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { logActivity } from "../middleware/activityLogger.js";

export interface ActorContext {
  userId: string;
  role: string;
  specialPrivilege?: string;
  campusId: string;
  ipAddress: string;
}

export async function createEvaluation(
  employeeId: string,
  data: { evaluationPeriod: string; efficiencyScore: number; workOutputScore: number },
  actor: ActorContext
) {
  if (!["HR_OFFICER", "ADMIN", "SUPER_ADMIN"].includes(actor.role)) {
    throw new AppError(403, "FORBIDDEN", "Only HR Officers and Admins can create evaluations");
  }
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new AppError(404, "NOT_FOUND", "Employee not found");

  const evaluation = await prisma.evaluation.create({
    data: { employeeId, evaluationPeriod: data.evaluationPeriod, efficiencyScore: data.efficiencyScore, workOutputScore: data.workOutputScore, createdBy: actor.userId },
  });

  await logActivity({ actingUserId: actor.userId, actingRole: actor.role, actionType: "EVALUATION_CREATED", resourceType: "Evaluation", resourceId: evaluation.id, newState: { employeeId, evaluationPeriod: data.evaluationPeriod }, ipAddress: actor.ipAddress });
  return evaluation;
}

export async function getEvaluation(id: string) {
  const evaluation = await prisma.evaluation.findUnique({ where: { id } });
  if (!evaluation) throw new AppError(404, "NOT_FOUND", "Evaluation not found");
  return evaluation;
}

export async function updateEvaluation(id: string, data: Partial<{ evaluationPeriod: string; efficiencyScore: number; workOutputScore: number }>, actor: ActorContext) {
  const existing = await prisma.evaluation.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "NOT_FOUND", "Evaluation not found");
  const updated = await prisma.evaluation.update({ where: { id }, data });
  await logActivity({ actingUserId: actor.userId, actingRole: actor.role, actionType: "EVALUATION_UPDATED", resourceType: "Evaluation", resourceId: id, previousState: existing, newState: updated, ipAddress: actor.ipAddress });
  return updated;
}

export async function listEvaluations(employeeId: string) {
  return prisma.evaluation.findMany({ where: { employeeId }, orderBy: { createdAt: "desc" } });
}
