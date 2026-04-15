/**
 * Generates a unique Employee ID in the format [CampusCode]-[Year]-[NNNNN].
 *
 * Uses a DB-level atomic upsert+increment on EmployeeIDCounter to guarantee
 * uniqueness even under concurrent requests.
 *
 * @param campusId - The UUID of the campus
 * @param year     - The calendar year (e.g. 2026)
 * @returns        Formatted ID, e.g. "BDU-2026-00045"
 */
export declare function generate(campusId: string, year: number): Promise<string>;
//# sourceMappingURL=employeeId.service.d.ts.map