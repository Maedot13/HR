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

export async function createProgram(data: { title: string; description: string; competencies: string[] }, actor: ActorContext) {
  const program = await prisma.trainingProgram.create({ data: { title: data.title, description: data.description, competencies: data.competencies } });
  await logActivity({ actingUserId: actor.userId, actingRole: actor.role, actionType: "TRAINING_PROGRAM_CREATED", resourceType: "TrainingProgram", resourceId: program.id, newState: { title: data.title }, ipAddress: actor.ipAddress });
  return program;
}

export async function listPrograms() {
  return prisma.trainingProgram.findMany({ orderBy: { title: "asc" } });
}

export async function assignTraining(employeeId: string, data: { trainingProgramId: string; expectedCompletion: string }, actor: ActorContext) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new AppError(404, "NOT_FOUND", "Employee not found");
  const program = await prisma.trainingProgram.findUnique({ where: { id: data.trainingProgramId } });
  if (!program) throw new AppError(404, "NOT_FOUND", "Training program not found");

  const assignment = await prisma.trainingAssignment.create({
    data: { employeeId, trainingProgramId: data.trainingProgramId, expectedCompletion: new Date(data.expectedCompletion), status: "ASSIGNED" },
  });
  await logActivity({ actingUserId: actor.userId, actingRole: actor.role, actionType: "TRAINING_ASSIGNED", resourceType: "TrainingAssignment", resourceId: assignment.id, newState: { employeeId, trainingProgramId: data.trainingProgramId }, ipAddress: actor.ipAddress });
  return assignment;
}

export async function completeTraining(assignmentId: string, actor: ActorContext) {
  const assignment = await prisma.trainingAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw new AppError(404, "NOT_FOUND", "Training assignment not found");
  const updated = await prisma.trainingAssignment.update({ where: { id: assignmentId }, data: { completionDate: new Date(), status: "COMPLETED" } });
  await logActivity({ actingUserId: actor.userId, actingRole: actor.role, actionType: "TRAINING_COMPLETED", resourceType: "TrainingAssignment", resourceId: assignmentId, previousState: { status: assignment.status }, newState: { status: "COMPLETED" }, ipAddress: actor.ipAddress });
  return updated;
}

export async function getSkillGapReport(employeeId: string) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new AppError(404, "NOT_FOUND", "Employee not found");
  const completed = await prisma.trainingAssignment.findMany({ where: { employeeId, status: "COMPLETED" }, include: { TrainingProgram: true } });
  const completedCompetencies = Array.from(new Set(completed.flatMap((a: { TrainingProgram: { competencies: string[] } }) => a.TrainingProgram.competencies)));
  return { required: [] as string[], completed: completedCompetencies, gaps: [] as string[] };
}
