export interface ActorContext {
    userId: string;
    role: string;
    campusId: string;
    ipAddress: string;
}
export declare function createCampus(code: string, name: string, actor: ActorContext): Promise<{
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    code: string;
}>;
export declare function listCampuses(): Promise<{
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    code: string;
}[]>;
export declare function getCampusById(id: string): Promise<{
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    code: string;
}>;
export declare function updateCampus(id: string, payload: Record<string, unknown>, actor: ActorContext): Promise<{
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    code: string;
}>;
export declare function deleteCampus(id: string, actor: ActorContext): Promise<void>;
export declare function createCollege(name: string, campusId: string, actor: ActorContext): Promise<{
    id: string;
    name: string;
    campusId: string;
}>;
export declare function listColleges(campusId?: string): Promise<{
    id: string;
    name: string;
    campusId: string;
}[]>;
export declare function getCollegeById(id: string): Promise<{
    id: string;
    name: string;
    campusId: string;
}>;
export declare function updateCollege(id: string, name: string, actor: ActorContext): Promise<{
    id: string;
    name: string;
    campusId: string;
}>;
export declare function deleteCollege(id: string, actor: ActorContext): Promise<void>;
export declare function createDepartment(name: string, collegeId: string, actor: ActorContext): Promise<{
    id: string;
    name: string;
    collegeId: string;
}>;
export declare function listDepartments(collegeId?: string): Promise<{
    id: string;
    name: string;
    collegeId: string;
}[]>;
export declare function getDepartmentById(id: string): Promise<{
    id: string;
    name: string;
    collegeId: string;
}>;
export declare function updateDepartment(id: string, name: string, actor: ActorContext): Promise<{
    id: string;
    name: string;
    collegeId: string;
}>;
export declare function deleteDepartment(id: string, actor: ActorContext): Promise<void>;
export declare function createUnit(name: string, departmentId: string, actor: ActorContext): Promise<{
    id: string;
    name: string;
    departmentId: string;
}>;
export declare function listUnits(departmentId?: string): Promise<{
    id: string;
    name: string;
    departmentId: string;
}[]>;
export declare function getUnitById(id: string): Promise<{
    id: string;
    name: string;
    departmentId: string;
}>;
export declare function updateUnit(id: string, name: string, actor: ActorContext): Promise<{
    id: string;
    name: string;
    departmentId: string;
}>;
export declare function deleteUnit(id: string, actor: ActorContext): Promise<void>;
/**
 * Validate that a unit belongs to the Admin's campus.
 * Used when linking an employee to a unit.
 */
export declare function validateUnitBelongsToCampus(unitId: string, campusId: string): Promise<void>;
//# sourceMappingURL=org.service.d.ts.map