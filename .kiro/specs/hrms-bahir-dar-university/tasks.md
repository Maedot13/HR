# Implementation Plan: HRMS — Bahir Dar University

## Overview

Full-stack implementation of the Bahir Dar University HRMS as a TypeScript monorepo. The backend is Node.js/Express with Prisma on Neon PostgreSQL; the frontend is React + Vite + Material UI. Tasks follow the dependency order: monorepo scaffold → shared types → database → auth → RBAC → modules (org, employee, recruitment, onboarding, timetable, leave, appraisal, training, payroll, clearance, experience letters, activity log) → document generation → frontend.

---

## Tasks

- [x] 1. Scaffold monorepo and shared package
  - Initialize workspace root `package.json` with `workspaces: ["apps/*", "packages/*", "prisma"]`
  - Create `apps/api`, `apps/web`, `packages/shared` directory structure
  - Configure root `tsconfig.json` with path aliases for `@hrms/shared`
  - Add `packages/shared/src/index.ts` exporting types, Zod schemas, and constants
  - Add `packages/shared/src/permissions.ts` with `computeEffectivePermissions` function (union of role + privilege permission sets)
  - Add `packages/shared/src/constants.ts` with `ROLE_PERMISSIONS` and `PRIVILEGE_PERMISSIONS` maps
  - _Requirements: 3.1, 3.2, 3.3, 3.6_

- [x] 2. Prisma schema and database setup
  - Create `prisma/schema.prisma` with all models: Campus, College, Department, Unit, Employee, EmployeeDocument, EmploymentHistory, UserRole, Permission, RolePermission, PrivilegePermission, EmployeeIDCounter, JobPosting, Application, ApplicationStage, OnboardingWorkflow, OnboardingDocument, AssetAssignment, ScheduleEntry, Substitution, LeaveType, LeaveBalance, LeaveApplication, Evaluation, TrainingProgram, TrainingAssignment, PayrollReport, PayrollExport, ClearanceBody, ClearanceRecord, ClearanceTask, ExperienceLetter, ActivityLog
  - Configure `DATABASE_URL` env var pointing to Neon PostgreSQL
  - Run `prisma migrate dev --name init` to generate and apply initial migration
  - Add `prisma/seed.ts` to seed LeaveType rows for all 13 leave type names and default Permission + RolePermission rows
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 9.1_

- [ ] 3. Express API bootstrap and middleware stack
  - Initialize `apps/api` with Express + TypeScript, configure `tsconfig.json` and `vitest.config.ts`
  - Add global middleware: `helmet`, `cors`, `express.json`, request-id injection
  - Add JWT verification middleware (`apps/api/src/middleware/auth.ts`) that extracts `userId`, `role`, `specialPrivilege`, `campusId` from Bearer token
  - Add first-login enforcement middleware that rejects all requests (except `POST /auth/change-password`) with 403 `PASSWORD_CHANGE_REQUIRED` when `isTempPassword = true`
  - Add global error handler middleware returning `{ error: { code, message, details } }` envelope
  - Add `apps/api/src/middleware/activityLogger.ts` — async helper that writes an `ActivityLog` row after every state-changing response
  - _Requirements: 3.7, 5.2, 16.1, 16.2_

  - [ ] 3.1 Write property test for first-login enforcement (Property 7)
    - **Property 7: First-Login Password Change Enforcement**
    - Generate requests from employees with `isTempPassword = true`; assert every endpoint except `POST /auth/change-password` returns 403 `PASSWORD_CHANGE_REQUIRED`
    - **Validates: Requirements 5.2**

- [ ] 4. RBAC middleware
  - Implement `apps/api/src/middleware/rbac.ts` — `requirePermission(code)` factory that calls `computeEffectivePermissions` and returns 403 if the permission is absent
  - Wire RBAC middleware onto all protected routes
  - _Requirements: 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ] 4.1 Write property test for effective permissions union (Property 4)
    - **Property 4: Effective Permissions Are the Union of Role and Privilege**
    - Generate arbitrary `(BaseRole, SpecialPrivilege | undefined)` pairs; assert `computeEffectivePermissions(role, priv)` equals `permissions(role) ∪ permissions(priv)` and never drops base-role permissions
    - **Validates: Requirements 3.3, 3.4, 3.6**

  - [ ] 4.2 Write property test for 403 on missing permission (Property 5)
    - **Property 5: Unauthorized Actions Return HTTP 403**
    - Generate permission-protected actions and users whose effective set lacks the required permission; assert HTTP 403 is returned
    - **Validates: Requirements 3.7, 3.8**

- [ ] 5. Authentication service and routes
  - Implement `AuthService`: `login` (bcrypt.compare, issue accessToken 15 m + refreshToken 7 d), `changePassword` (hash with bcrypt cost 12, clear `isTempPassword`), `logout` (revoke refresh token)
  - Add routes: `POST /api/v1/auth/login`, `POST /api/v1/auth/change-password`, `POST /api/v1/auth/logout`
  - Store passwords as bcrypt hashes with cost factor ≥ 12
  - _Requirements: 5.1, 5.2, 5.3_

  - [ ] 5.1 Write property test for bcrypt hash storage (Property 8)
    - **Property 8: Password Storage as Bcrypt Hash**
    - Generate arbitrary password strings; assert stored value matches `$2b$12$...` pattern and `bcrypt.compare` returns true
    - **Validates: Requirements 5.3**

- [ ] 6. Organizational hierarchy service and routes
  - Implement `OrgService` with CRUD for Campus, College, Department, Unit
  - Enforce Campus_Code immutability on update (reject with `CAMPUS_CODE_IMMUTABLE` if code field changes)
  - Enforce campus deletion guard (reject with `CAMPUS_HAS_EMPLOYEES` if linked employees exist)
  - Enforce cross-campus unit validation for Admin role
  - Add routes: `GET/POST /campuses`, `GET/PUT/DELETE /campuses/:id`, `GET/POST /campuses/:id/colleges`, `GET/PUT/DELETE /colleges/:id`, `GET/POST /colleges/:id/departments`, `GET/PUT/DELETE /departments/:id`, `GET/POST /departments/:id/units`, `GET/PUT/DELETE /units/:id`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [ ] 6.1 Write property test for organizational hierarchy membership (Property 1)
    - **Property 1: Organizational Hierarchy Membership**
    - Generate random org trees; assert every Department has exactly one College parent and every Unit has exactly one Department parent; assert no orphaned nodes exist
    - **Validates: Requirements 1.1, 1.6, 1.7**

  - [ ] 6.2 Write property test for campus code immutability (Property 2)
    - **Property 2: Campus Code Immutability**
    - Generate a campus and a random update payload; assert Campus_Code is identical before and after the update
    - **Validates: Requirements 1.2, 1.3**

  - [ ] 6.3 Write property test for campus deletion blocked with employees (Property 3)
    - **Property 3: Campus Deletion Blocked When Employees Exist**
    - Generate a campus with N ≥ 1 linked employees; assert deletion is rejected with `CAMPUS_HAS_EMPLOYEES`; assert deletion succeeds when N = 0
    - **Validates: Requirements 1.4, 1.5**

- [ ] 7. Employee ID generation service
  - Implement `EmployeeIDService.generate(campusId, year)` using a DB-level atomic increment on `EmployeeIDCounter` (upsert + increment in a transaction)
  - Format output as `[CampusCode]-[Year]-[00001]` (zero-padded 5 digits)
  - Reset sequence to 1 at the start of each new calendar year (handled by upsert logic)
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ] 7.1 Write property test for Employee ID uniqueness (Property 6)
    - **Property 6: Employee ID Uniqueness Per Campus Per Year**
    - Generate N concurrent employee creations under the same campus/year; assert all generated IDs are distinct and sequence increments by exactly 1
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [ ] 8. Employee profile service and routes
  - Implement `EmployeeService`: create (auto-generate temp password, hash with bcrypt cost 12, call `EmployeeIDService.generate`), read, update, activate (validate mandatory fields), upload document, list documents, employment history
  - Activation validation: reject with `INCOMPLETE_PROFILE` listing missing fields if any of `fullName, dateOfBirth, gender, nationality, contactInfo, emergencyContact` is null
  - Write `EmploymentHistory` row on every position/department/status change
  - Add routes: `GET/POST /employees`, `GET/PUT /employees/:id`, `POST /employees/:id/activate`, `GET/POST /employees/:id/documents`, `GET /employees/:id/history`
  - Add role/privilege assignment routes: `PUT /employees/:id/role`, `PUT /employees/:id/privilege`, `GET /employees/:id/permissions`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 5.1_

  - [ ] 8.1 Write property test for profile activation requires complete fields (Property 20)
    - **Property 20: Employee Profile Activation Requires Complete Mandatory Fields**
    - Generate employee profiles with one or more mandatory fields set to null; assert activation is rejected and the response lists exactly the missing fields
    - **Validates: Requirements 2.5, 2.6**

- [ ] 9. Checkpoint — core infrastructure complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Recruitment service and routes
  - Implement `RecruitmentService`: createPosting, listPostings, getPosting, updatePosting, submitApplication (reject if past deadline with `APPLICATION_AFTER_DEADLINE`), advanceStage (enforce Screening → Interview → Selection → Offer order; reject with `ACADEMIC_SCORE_REQUIRED` if academic role and no `publicationEvalScore` when advancing past Screening), issueOffer
  - Auto-create `OnboardingWorkflow` when application advances to Selection stage
  - Add routes: `GET/POST /job-postings`, `GET/PUT /job-postings/:id`, `GET/POST /job-postings/:id/applications`, `PUT /applications/:id/advance`, `POST /applications/:id/offer`
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 7.1_

  - [ ] 10.1 Write property test for recruitment stage ordering (Property 9)
    - **Property 9: Recruitment Stage Ordering**
    - Generate arbitrary stage transition sequences; assert only Screening → Interview → Selection → Offer is accepted; assert backwards and skip transitions are rejected; assert academic role applications without `publicationEvalScore` are rejected at Screening → Interview
    - **Validates: Requirements 6.4, 6.5, 6.6**

- [ ] 11. Onboarding service and routes
  - Implement `OnboardingService`: getWorkflow, markDocumentCollected, markAssetAssigned, completeOnboarding (validate all `isCollected = true` and `isAssigned = true`; reject with `ONBOARDING_INCOMPLETE` listing missing items; on success call `EmployeeIDService.generate` and create Employee record)
  - Add routes: `GET /onboarding/:workflowId`, `PUT /onboarding/:workflowId/documents/:docId`, `PUT /onboarding/:workflowId/assets/:assetId`, `POST /onboarding/:workflowId/complete`
  - _Requirements: 7.2, 7.3, 7.4_

  - [ ] 11.1 Write property test for onboarding completion gate (Property 15)
    - **Property 15: Onboarding Completion Requires All Documents and Assets**
    - Generate onboarding workflows with at least one `isCollected = false` or `isAssigned = false`; assert `complete` is rejected and response lists all missing items
    - **Validates: Requirements 7.3, 7.4**

- [ ] 12. Timetable service and routes
  - Implement `TimetableService`: createEntry (check instructor overlap on same day/time slot; reject with `SCHEDULE_CONFLICT` describing the conflicting entry), updateEntry, deleteEntry, recordSubstitution, getEmployeeTimetable (read-only)
  - Add routes: `GET/POST /schedule`, `GET/PUT/DELETE /schedule/:id`, `POST /schedule/:id/substitution`, `GET /employees/:id/timetable`
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 13. Leave management service and routes
  - Implement `LeaveService`:
    - `submitApplication`: validate balance ≥ requested days (reject with `INSUFFICIENT_LEAVE_BALANCE` including `currentBalance` and `shortfall`); validate leave-type-specific eligibility rules (research, sabbatical, study, sick, maternity, paternity, personal, special, leave-without-pay, seminar)
    - `approveApplication`: deduct days from `LeaveBalance`, set status APPROVED, write ActivityLog
    - `rejectApplication`: set status REJECTED, record `rejectionReason`
    - `getBalances`: return all leave balances per type for an employee
    - Eligibility rules:
      - Research leave: rank ≥ Assistant Professor AND ≥ 3 consecutive years service; else reject with `LEAVE_ELIGIBILITY_FAILED` listing unmet criteria
      - Sabbatical: full-time Academic_Staff, rank ≥ Assistant Professor, ≥ 6 continuous years; else reject with `LEAVE_ELIGIBILITY_FAILED`
      - Sick leave: enforce 6-month full-pay cap then 2-month half-pay cap within rolling 12 months; reject with `SICK_LEAVE_CAP_EXCEEDED` if total would exceed 8 months
      - Annual leave entitlement: `min(19 + yearsOfService, 30)` working days; Academic_Staff outside July–August requires explicit approval
      - Leave-without-pay: requires University President approval (special privilege check); max 2 years
  - Add routes: `GET /leave/types`, `GET /employees/:id/leave/balances`, `GET/POST /employees/:id/leave/applications`, `PUT /leave/applications/:id/approve`, `PUT /leave/applications/:id/reject`
  - _Requirements: 9.1–9.26_

  - [ ] 13.1 Write property test for leave balance never negative (Property 10)
    - **Property 10: Leave Balance Never Goes Negative**
    - Generate sequences of leave approvals; assert balance never falls below zero; assert approved duration is deducted exactly; assert pending/rejected applications leave balance unchanged
    - **Validates: Requirements 9.2, 9.3, 9.4**

  - [ ] 13.2 Write property test for annual leave entitlement calculation (Property 11)
    - **Property 11: Annual Leave Entitlement Calculation**
    - Generate `yearsOfService` values (1–30+); assert entitlement equals `min(19 + N, 30)`; assert Academic_Staff applications outside July–August are flagged for approval
    - **Validates: Requirements 9.8, 9.9**

  - [ ] 13.3 Write property test for research leave eligibility (Property 12)
    - **Property 12: Research Leave Eligibility Enforcement**
    - Generate applicants with varying rank and service years; assert rejection when rank < Assistant Professor or service < 3 years; assert approval path when both criteria met
    - **Validates: Requirements 9.21, 9.22**

  - [ ] 13.4 Write property test for sabbatical leave eligibility (Property 13)
    - **Property 13: Sabbatical Leave Eligibility Enforcement**
    - Generate applicants with varying full-time status, rank, and service years; assert rejection when any of the three criteria is unmet; assert all three criteria are checked independently
    - **Validates: Requirements 9.23, 9.24, 9.25**

  - [ ] 13.5 Write property test for sick leave 8-month cap (Property 14)
    - **Property 14: Sick Leave 8-Month Hard Cap**
    - Generate sick leave application sequences within a rolling 12-month window; assert first 6 months are full pay, months 7–8 are half pay, and any application exceeding 8 months total is rejected with `SICK_LEAVE_CAP_EXCEEDED`
    - **Validates: Requirements 9.13, 9.14, 9.15**

- [ ] 14. Checkpoint — leave and recruitment modules complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. Performance appraisal service and routes
  - Implement `AppraisalService`: createEvaluation (restricted to HR_Officer/Admin), getEvaluation, updateEvaluation, notifyEmployee on save
  - Add routes: `GET/POST /employees/:id/evaluations`, `GET/PUT /evaluations/:id`
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ] 16. Training and LMS service and routes
  - Implement `TrainingService`: createProgram, listPrograms, assignTraining (record title, assignedDate, expectedCompletion), completeTraining (record completionDate, set status COMPLETED), getSkillGapReport (diff required competencies for role against completed training records)
  - Add routes: `GET/POST /training/programs`, `POST /employees/:id/training`, `PUT /training/assignments/:id/complete`, `GET /employees/:id/skill-gap`
  - _Requirements: 11.1, 11.2, 11.3_

- [ ] 17. Payroll reporting service and routes
  - Implement `PayrollService`: generateReport (compile salary + bonus data for all active employees in period), exportReport (generate file in requested format and store URL), validateReport (Finance_Actor sets status to VALIDATED)
  - Integrate `exceljs` for Excel export and `pdfkit` (or `puppeteer`) for PDF export
  - Add routes: `GET/POST /payroll/reports`, `GET /payroll/reports/:id`, `POST /payroll/reports/:id/export`, `PUT /payroll/reports/:id/validate`
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ] 18. Clearance and offboarding service and routes
  - Implement `ClearanceService`:
    - `configureBodies`: CRUD for ClearanceBody (name, approvalMode, order)
    - `initiateClearance`: create ClearanceRecord (IN_PROGRESS), generate one ClearanceTask per configured ClearanceBody; activate all PARALLEL tasks immediately; activate only the first SEQUENTIAL task
    - `approveTask`: record approver + timestamp; if SEQUENTIAL activate next task; if all tasks APPROVED set ClearanceRecord.status = COMPLETED and trigger account deactivation
    - `rejectTask`: record rejection reason, notify employee
    - Account deactivation: set `Employee.status = INACTIVE`, revoke all active JWT sessions
  - Add routes: `GET/POST /clearance/bodies`, `PUT /clearance/bodies/:id`, `POST /employees/:id/clearance`, `GET /employees/:id/clearance`, `PUT /clearance/tasks/:id/approve`, `PUT /clearance/tasks/:id/reject`
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 15.1, 15.2, 15.3_

  - [ ] 18.1 Write property test for clearance completion iff all tasks approved (Property 16)
    - **Property 16: Clearance Completion Iff All Tasks Approved**
    - Generate clearance task approval sequences (mixed sequential and parallel); assert ClearanceRecord status is COMPLETED if and only if every task is APPROVED; assert sequential tasks do not become ACTIVE before preceding tasks are APPROVED
    - **Validates: Requirements 13.3, 13.5, 13.7**

  - [ ] 18.2 Write property test for clearance triggers account deactivation (Property 19)
    - **Property 19: Clearance Triggers Account Deactivation**
    - Generate employees whose ClearanceRecord transitions to COMPLETED; assert `Employee.status = INACTIVE`, all JWT sessions revoked, and all historical records remain accessible
    - **Validates: Requirements 15.1, 15.2, 15.3**

- [ ] 19. Experience letter generation service and routes
  - Implement `DocumentService.generateExperienceLetter`: auto-populate full name, most recent position title, and total employment duration (hireDate to endDate); render to PDF using `pdfkit` and to DOCX using `docx`; store file and create `ExperienceLetter` record
  - Restrict endpoint to HR_Officer role via RBAC middleware
  - Add routes: `POST /employees/:id/experience-letter`, `GET /employees/:id/experience-letters`
  - _Requirements: 14.1, 14.2, 14.3_

- [ ] 20. Activity log service and routes
  - Implement `ActivityLogService.create` (write-only; no update or delete methods exposed); enforce immutability at service layer (throw `ACTIVITY_LOG_IMMUTABLE` on any update/delete attempt)
  - Add DB-level trigger in a Prisma migration to block UPDATE/DELETE on `ActivityLog` table
  - Add `GET /api/v1/activity-logs` with query filters: `userId`, `actionType`, `resourceType`, `startDate`, `endDate`, `campusId`
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6_

  - [ ] 20.1 Write property test for activity log completeness (Property 17)
    - **Property 17: Activity Log Completeness**
    - Generate state-changing actions across all modules; assert each produces an ActivityLog entry with all required fields (`actingUserId`, `actingRole`, `actionType`, `resourceType`, `resourceId`, `previousState`/`newState`, `timestamp`, `ipAddress`); assert `previousState` is null only on creation actions
    - **Validates: Requirements 16.1, 16.2**

  - [ ] 20.2 Write property test for activity log immutability (Property 18)
    - **Property 18: Activity Log Immutability**
    - Generate update and delete attempts on ActivityLog entries for users of all roles including Super_Admin; assert all attempts are rejected; assert all log entries for deactivated employees remain fully retrievable
    - **Validates: Requirements 16.3, 16.6**

- [ ] 21. Checkpoint — all backend services complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 22. Integration tests for full pipelines
  - [ ] 22.1 Write integration test for full recruitment pipeline
    - Test: create job posting → submit application → advance through all stages → issue offer
    - _Requirements: 6.1–6.7_

  - [ ] 22.2 Write integration test for full onboarding pipeline
    - Test: application reaches Selection → onboarding workflow auto-created → collect all documents → assign all assets → complete onboarding → employee record created with generated ID
    - _Requirements: 7.1–7.4_

  - [ ] 22.3 Write integration test for full clearance pipeline
    - Test: initiate clearance → approve sequential tasks in order → approve parallel tasks → all tasks approved → ClearanceRecord COMPLETED → Employee INACTIVE → sessions revoked
    - _Requirements: 13.1–13.7, 15.1–15.3_

  - [ ] 22.4 Write integration test for JWT authentication flow
    - Test: login → receive tokens → access protected route → logout → verify token invalid
    - _Requirements: 5.1, 5.2, 3.7_

  - [ ] 22.5 Write integration test for leave balance deduction end-to-end
    - Test: submit leave application → approve → verify balance decremented in DB by exact approved duration
    - _Requirements: 9.2, 9.3, 9.4_

- [ ] 23. React frontend bootstrap
  - Initialize `apps/web` with Vite + React + TypeScript
  - Install and configure Material UI (MUI v5), React Router v6, React Query, Axios
  - Set up global theme, layout shell (sidebar nav, top bar), and protected route wrapper (redirect to login if no valid token)
  - Add `AuthContext` providing `user`, `login`, `logout`, and `changePassword` actions
  - Implement login page with first-login password change enforcement (redirect to change-password form when `PASSWORD_CHANGE_REQUIRED` is returned)
  - _Requirements: 5.2_

- [ ] 24. Frontend: Organizational hierarchy module
  - Implement Campus list/create/edit/delete pages (Super_Admin only)
  - Implement College, Department, Unit nested management pages
  - Enforce Campus_Code read-only on edit form
  - _Requirements: 1.1–1.8_

- [ ] 25. Frontend: Employee profile module
  - Implement employee list page with search and filters
  - Implement employee create/edit form with all mandatory fields, academic rank selector, document upload
  - Implement employee activation button with validation error display (list missing fields)
  - Implement employment history timeline view (read-only)
  - Implement role and special privilege assignment form (Super_Admin/Admin only)
  - _Requirements: 2.1–2.7, 3.1–3.8_

- [ ] 26. Frontend: Recruitment ATS module
  - Implement job posting list and create/edit form
  - Implement application list per posting with stage pipeline view (Kanban or stepper)
  - Implement advance-stage action with publication score input for academic roles
  - Implement offer issuance form
  - _Requirements: 6.1–6.7_

- [ ] 27. Frontend: Onboarding module
  - Implement onboarding workflow detail page showing document checklist and asset assignment checklist
  - Implement mark-collected and mark-assigned toggle actions
  - Implement complete-onboarding button with missing-items error display
  - _Requirements: 7.1–7.4_

- [ ] 28. Frontend: Timetable module
  - Implement schedule entry create/edit form with conflict error display
  - Implement weekly timetable grid view per employee (read-only for Employee role)
  - Implement substitution recording form
  - _Requirements: 8.1–8.5_

- [ ] 29. Frontend: Leave management module
  - Implement ESS leave application form (leave type selector, date range picker, reason, supporting doc upload)
  - Implement leave balance dashboard per type
  - Implement leave application list with status badges and approval/rejection actions for HR_Officer/Admin
  - Implement rejection reason input dialog
  - _Requirements: 9.1–9.26_

- [ ] 30. Frontend: Performance appraisal module
  - Implement evaluation create/edit form (HR_Officer/Admin only)
  - Implement employee appraisal result view (read-only for Employee role)
  - _Requirements: 10.1–10.4_

- [ ] 31. Frontend: Training and LMS module
  - Implement training program list and create form
  - Implement training assignment form per employee with expected completion date
  - Implement mark-complete action
  - Implement skill gap report view per employee
  - _Requirements: 11.1–11.3_

- [ ] 32. Frontend: Payroll reporting module
  - Implement payroll report generation form (period selector)
  - Implement report list with export buttons (Excel, PDF, DOCX)
  - Implement Finance_Actor validation action
  - _Requirements: 12.1–12.5_

- [ ] 33. Frontend: Clearance and offboarding module
  - Implement clearance body configuration page (Super_Admin/Admin)
  - Implement initiate clearance action on employee profile
  - Implement clearance task board showing sequential and parallel tasks with approve/reject actions
  - _Requirements: 13.1–13.7_

- [ ] 34. Frontend: Experience letter and account management
  - Implement experience letter generation form (HR_Officer only) with format selector (PDF/DOCX)
  - Implement generated letters list with download links
  - Implement deactivated employee record view (Super_Admin only)
  - _Requirements: 14.1–14.3, 15.1–15.4_

- [ ] 35. Frontend: Activity log viewer
  - Implement activity log table with filters: user, action type, resource type, date range, campus
  - Display all required fields per log entry in a paginated table (read-only)
  - _Requirements: 16.4_

- [ ] 36. Final checkpoint — full system wired and tested
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` with a minimum of 100 iterations per property
- Unit tests and property tests are complementary — both should be present for critical business logic
- Checkpoints ensure incremental validation at key milestones
- The activity logger middleware (task 3) must be wired into every service before integration tests are written
