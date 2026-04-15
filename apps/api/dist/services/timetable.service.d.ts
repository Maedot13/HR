export interface ActorContext {
    userId: string;
    role: string;
    ipAddress: string;
}
export interface CreateEntryData {
    employeeId: string;
    course: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    location: string;
}
export interface UpdateEntryData {
    course?: string;
    dayOfWeek?: number;
    startTime?: string;
    endTime?: string;
    location?: string;
}
export declare function createEntry(data: CreateEntryData, actor: ActorContext): Promise<{
    id: string;
    employeeId: string;
    createdAt: Date;
    course: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    location: string;
}>;
export declare function updateEntry(id: string, data: UpdateEntryData, actor: ActorContext): Promise<{
    id: string;
    employeeId: string;
    createdAt: Date;
    course: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    location: string;
}>;
export declare function deleteEntry(id: string, actor: ActorContext): Promise<void>;
export declare function recordSubstitution(scheduleEntryId: string, data: {
    substituteId: string;
    sessionDate: string;
}, actor: ActorContext): Promise<{
    id: string;
    substituteId: string;
    sessionDate: Date;
    loggedAt: Date;
    loggedBy: string;
    scheduleEntryId: string;
}>;
export declare function getEmployeeTimetable(employeeId: string): Promise<{
    id: string;
    employeeId: string;
    createdAt: Date;
    course: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    location: string;
}[]>;
//# sourceMappingURL=timetable.service.d.ts.map