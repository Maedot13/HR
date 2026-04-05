# Requirements Document

## Introduction

This document defines the requirements for the Human Resource Management System (HRMS) for Bahir Dar University. The system manages the full employee lifecycle — from recruitment and onboarding through time management, performance appraisal, payroll reporting, and offboarding — across multiple campuses, colleges, departments, and units. The system is built on a React/TypeScript frontend, Node.js/Express backend, and PostgreSQL database via Prisma ORM. A system-wide, immutable activity log captures every user action across all modules to support audit, compliance, and incident investigation.

---

## Glossary

- **HRMS**: Human Resource Management System — the software system described in this document.
- **Super_Admin**: A system-level administrator with full access across all campuses.
- **Admin**: A campus-level administrator with management access scoped to one campus.
- **HR_Officer**: A user responsible for HR operations such as recruitment, appraisal, and payroll reporting.
- **Employee**: A registered staff member with self-service access to their own data.
- **Campus**: The top-level organizational unit (e.g., main campus, satellite campus).
- **College**: An academic division within a Campus.
- **Department**: An academic or administrative unit within a College.
- **Unit**: A sub-unit within a Department.
- **Campus_Code**: An immutable, unique alphanumeric identifier assigned to a Campus at creation time.
- **Employee_ID**: A system-generated unique identifier in the format `[CampusCode]-[Year]-[Sequence]` (e.g., `AAU-2026-00045`).
- **RBAC**: Role-Based Access Control — the mechanism for assigning permissions via roles.
- **Special_Privilege**: An additional permission layer assigned independently of a user's base role (e.g., Dean, Director).
- **ATS**: Applicant Tracking System — the module managing recruitment stages.
- **ESS**: Employee Self-Service — the portal through which employees manage their own requests.
- **Clearance**: The multi-department approval process required before an employee's account is deactivated upon separation.
- **Clearance_Body**: Any university department or unit (e.g., Library, IT, Finance, Store, Lab, Sport, Security) that must approve an employee's clearance before separation is finalized.
- **Sabbatical**: An extended leave of absence available to eligible academic staff.
- **Sabbatical_Leave**: An extended paid leave of one year available to full-time academic staff (Assistant Professor and above) who have served continuously for at least 6 years.
- **Study_Leave**: Leave granted to academic staff pursuing a higher degree at a recognized institution.
- **Research_Leave**: Leave of up to 6 months granted to full-time academic staff (Assistant Professor and above) with at least 3 consecutive years of service.
- **LMS**: Learning Management System — the module for training assignment and tracking.
- **Onboarding**: The process of integrating a newly selected candidate into the university as an employee.
- **Offboarding**: The process of separating an employee from the university, including clearance and account deactivation.
- **Academic_Staff**: Employees holding an academic rank (Lecturer, Assistant Professor, Associate Professor).
- **Finance_Actor**: The Finance department user who requests and receives payroll reports from HR.
- **Sequence**: A per-campus, per-year counter used in Employee_ID generation, reset to 1 at the start of each calendar year.
- **Activity_Log**: A system-wide, tamper-evident record of every action performed by any user, capturing who did what, when, and on which resource.

---

## Requirements

### Requirement 1: Campus & Organizational Hierarchy Management

**User Story:** As a Super_Admin, I want to manage the university's organizational hierarchy, so that all employees and resources are correctly scoped to their campus, college, department, and unit.

#### Acceptance Criteria

1. THE HRMS SHALL enforce a four-level organizational hierarchy: Campus → College → Department → Unit.
2. WHEN a Super_Admin submits a valid campus creation request, THE HRMS SHALL create a Campus record with a unique, immutable Campus_Code.
3. WHEN a Super_Admin submits a campus update request, THE HRMS SHALL update all campus fields except the Campus_Code.
4. WHEN a Super_Admin submits a campus deletion request and no employees are linked to that campus, THE HRMS SHALL delete the campus record.
5. IF a Super_Admin submits a campus deletion request and one or more employees are linked to that campus, THEN THE HRMS SHALL reject the request and return a descriptive error message.
6. WHEN a Super_Admin or Admin creates a Department, THE HRMS SHALL associate the Department with exactly one Campus.
7. WHEN a Super_Admin or Admin creates a Unit, THE HRMS SHALL associate the Unit with exactly one Department.
8. WHEN an Admin links an Employee to an organizational unit, THE HRMS SHALL validate that the unit belongs to the Admin's campus before saving the association.

---

### Requirement 2: Employee Information & Profile Management

**User Story:** As an HR_Officer, I want to store and manage complete employee profiles, so that the university maintains accurate and up-to-date personnel records.

#### Acceptance Criteria

1. THE HRMS SHALL store the following personal data for each Employee: full name, date of birth, gender, nationality, contact information, and emergency contact.
2. THE HRMS SHALL store the academic rank for Academic_Staff employees, limited to the values: Lecturer, Assistant Professor, and Associate Professor.
3. WHEN an HR_Officer uploads a document (appointment letter or contract) for an Employee, THE HRMS SHALL associate the document with the Employee's profile and record the upload timestamp.
4. THE HRMS SHALL maintain an employment history log for each Employee, recording each change to position, department, or employment status with a timestamp and the identity of the user who made the change.
5. WHEN an HR_Officer attempts to activate an Employee profile, THE HRMS SHALL validate that all mandatory profile fields are complete before changing the status to active.
6. IF mandatory profile fields are incomplete when activation is attempted, THEN THE HRMS SHALL reject the activation and return a list of the missing fields.
7. THE HRMS SHALL record an Activity_Log entry for every create, update, or status-change action performed on an Employee profile, capturing the acting user, the changed fields, the previous values, the new values, and the timestamp.

---

### Requirement 3: Security, RBAC & Special Privilege System

**User Story:** As a Super_Admin, I want to assign roles and special privileges to users, so that each user has exactly the permissions required for their responsibilities.

#### Acceptance Criteria

1. THE HRMS SHALL support four base roles: Super_Admin, Admin, HR_Officer, and Employee.
2. THE HRMS SHALL support the following special privilege designations: University President, Vice President, Dean, and Director.
3. WHEN a Super_Admin assigns a base role to a user, THE HRMS SHALL grant the user all permissions associated with that role.
4. WHEN an Admin assigns a Special_Privilege to a user, THE HRMS SHALL add the privilege's permissions to the user's effective permission set without removing the user's base role permissions.
5. WHEN an Admin updates a user's Special_Privilege, THE HRMS SHALL apply the updated privilege permissions immediately upon save.
6. THE HRMS SHALL compute a user's effective permissions as the union of their base role permissions and any assigned Special_Privilege permissions.
7. WHEN a user attempts an action, THE HRMS SHALL evaluate the user's effective permissions and reject the action if the required permission is absent, returning an HTTP 403 response.
8. IF a user holds a Special_Privilege that grants a permission not included in their base role, THEN THE HRMS SHALL allow the action governed by that permission.

---

### Requirement 4: Unique Employee ID Generation

**User Story:** As an HR_Officer, I want the system to automatically generate unique Employee IDs, so that every employee can be unambiguously identified across all campuses and years.

#### Acceptance Criteria

1. WHEN a new Employee record is created, THE HRMS SHALL generate an Employee_ID in the format `[CampusCode]-[Year]-[Sequence]`, where Year is the current calendar year and Sequence is a zero-padded five-digit integer.
2. THE HRMS SHALL maintain a separate Sequence counter per Campus per calendar year, incrementing by 1 for each new Employee registered under that campus in that year.
3. WHEN a new calendar year begins, THE HRMS SHALL reset the Sequence counter for each Campus to 1.
4. THE HRMS SHALL guarantee that no two Employee records share the same Employee_ID.

---

### Requirement 5: Credential Management

**User Story:** As an HR_Officer, I want the system to auto-generate credentials for new employees, so that accounts are ready immediately after registration without manual password setup.

#### Acceptance Criteria

1. WHEN a new Employee account is created, THE HRMS SHALL auto-generate a temporary password and associate it with the account.
2. WHEN an Employee logs in for the first time using a temporary password, THE HRMS SHALL require the Employee to set a new password before granting access to any other feature.
3. THE HRMS SHALL store all passwords as cryptographic hashes using a secure hashing algorithm (bcrypt with a minimum cost factor of 12).

---

### Requirement 6: Recruitment & Applicant Tracking

**User Story:** As an HR_Officer, I want to post job openings and track applicants through a structured pipeline, so that the university can hire qualified candidates efficiently.

#### Acceptance Criteria

1. WHEN an HR_Officer creates a job posting, THE HRMS SHALL record the posting type (internal or external), title, description, requirements, and application deadline.
2. WHEN a candidate submits an application before the deadline, THE HRMS SHALL record the application and set its stage to "Screening".
3. IF a candidate submits an application after the deadline, THEN THE HRMS SHALL reject the submission and return a descriptive error message.
4. THE HRMS SHALL support the following recruitment stages in order: Screening → Interview → Selection → Offer.
5. WHEN an HR_Officer advances an application to the next stage, THE HRMS SHALL record the stage transition with a timestamp.
6. WHEN a job posting is for an academic role, THE HRMS SHALL require the HR_Officer to record a publication evaluation score before advancing the application past the Screening stage.
7. WHEN an HR_Officer issues an offer, THE HRMS SHALL record the offer details and notify the candidate.

---

### Requirement 7: Digital Onboarding

**User Story:** As an HR_Officer, I want onboarding to begin automatically after a candidate is selected, so that new employees are integrated into the system without manual initiation.

#### Acceptance Criteria

1. WHEN an application reaches the "Selection" stage, THE HRMS SHALL automatically trigger an onboarding workflow for the candidate.
2. WHEN onboarding is triggered, THE HRMS SHALL present a document collection checklist to the HR_Officer.
3. WHEN all required documents are collected and assets are assigned, THE HRMS SHALL allow the HR_Officer to register the candidate as an Employee and generate the Employee_ID.
4. IF required onboarding documents are missing when the HR_Officer attempts to complete registration, THEN THE HRMS SHALL reject the registration and list the missing documents.

---

### Requirement 8: Shift & Timetable Management

**User Story:** As an Admin, I want to create and manage lecture schedules and instructor assignments, so that teaching duties are organized without conflicts.

#### Acceptance Criteria

1. WHEN an Admin creates a lecture schedule entry, THE HRMS SHALL record the course, assigned instructor, day, start time, end time, and location.
2. WHEN a new schedule entry is submitted, THE HRMS SHALL check whether the assigned instructor already has a schedule entry that overlaps the same time slot on the same day.
3. IF a scheduling conflict is detected for an instructor, THEN THE HRMS SHALL reject the entry and return a conflict description identifying the overlapping schedule.
4. WHEN an Admin records a substitution, THE HRMS SHALL replace the original instructor with the substitute for the specified session and log the change.
5. WHEN an Employee requests to view a timetable, THE HRMS SHALL return the timetable data for the requested employee in read-only format.

---

### Requirement 9: Leave Management

**User Story:** As an Employee, I want to apply for leave through the ESS portal and track my leave balance, so that I can plan my time off transparently.

#### Acceptance Criteria

1. WHEN an Employee submits a leave application via ESS, THE HRMS SHALL record the leave type, start date, end date, and reason, and set the status to "Pending".
2. WHEN a leave application is submitted, THE HRMS SHALL verify that the Employee has sufficient leave balance for the requested leave type and duration.
3. IF the Employee's leave balance is insufficient, THEN THE HRMS SHALL reject the application and return the current balance and the shortfall.
4. WHEN an HR_Officer or Admin approves a leave application, THE HRMS SHALL deduct the approved duration from the Employee's leave balance and set the status to "Approved".
5. WHEN an HR_Officer or Admin rejects a leave application, THE HRMS SHALL set the status to "Rejected" and record the rejection reason.
6. THE HRMS SHALL display each Employee's current leave balance per leave type in the ESS portal.
7. WHILE an Employee is logged into ESS, THE HRMS SHALL allow the Employee to view the timetables and shift schedules of other employees in read-only format.

**Annual Leave (Article 62)**

8. THE HRMS SHALL grant each Employee an annual leave entitlement of 20 working days for the first year of service, plus 1 additional working day for each subsequent year of service, up to a maximum of 30 working days.
9. WHERE an Employee is Academic_Staff, THE HRMS SHALL schedule annual leave during the summer recess period (July–August) unless an alternative period is approved by an HR_Officer or Admin.

**Maternity Leave (Article 65)**

10. WHEN a female Employee submits a maternity leave application, THE HRMS SHALL grant 30 calendar days of prenatal leave and 90 calendar days of postnatal leave at full pay.
11. WHEN a female Employee submits a leave application citing miscarriage, THE HRMS SHALL grant the applicable leave duration as specified in the university's maternity leave provisions at full pay.

**Paternity Leave (Article 66)**

12. WHEN a male Employee submits a paternity leave application, THE HRMS SHALL grant 10 working days of paternity leave at full pay.

**Sick Leave (Article 67)**

13. WHEN an Employee submits a sick leave application supported by a medical certificate, THE HRMS SHALL grant sick leave for up to 6 months at full pay within a 12-month period.
14. WHEN an Employee's sick leave within a 12-month period exceeds 6 months, THE HRMS SHALL grant up to 2 additional months of sick leave at half pay.
15. IF an Employee's total sick leave within a 12-month period exceeds 8 months, THEN THE HRMS SHALL reject further sick leave applications for that period and notify the HR_Officer.

**Leave for Personal Matters (Article 68)**

16. WHEN an Employee submits a leave application for marriage or bereavement of an immediate family member, THE HRMS SHALL grant 3 working days of paid leave for personal matters.

**Special Leave (Article 69)**

17. WHEN an Employee submits a special leave application citing a court summons or election duty, THE HRMS SHALL grant the required number of days as special leave with full pay, subject to HR_Officer approval.

**Leave without Pay (Article 70)**

18. WHEN an Employee submits a leave-without-pay application, THE HRMS SHALL require approval from the University President and SHALL grant a maximum of 2 years of unpaid leave.
19. IF a leave-without-pay application does not carry University President approval, THEN THE HRMS SHALL reject the application and return a descriptive error message.

**Study Leave (Article 71)**

20. WHERE an Employee is Academic_Staff pursuing a higher degree at a recognized institution, THE HRMS SHALL support a Study_Leave application with full pay for the first year and 50% pay for each subsequent year, subject to HR_Officer approval.

**Research Leave (Article 72)**

21. WHEN an Academic_Staff member holding the rank of Assistant Professor or above, with at least 3 consecutive years of service, submits a Research_Leave application, THE HRMS SHALL grant up to 6 months of Research_Leave at full pay.
22. IF a Research_Leave applicant does not hold the rank of Assistant Professor or above, or has fewer than 3 consecutive years of service, THEN THE HRMS SHALL reject the application and return the specific unmet criteria.

**Sabbatical Leave (Article 74)**

23. WHEN an HR_Officer evaluates a Sabbatical_Leave application, THE HRMS SHALL automatically determine eligibility: the applicant must be full-time Academic_Staff holding the rank of Assistant Professor or above, and must have served the university continuously for at least 6 years.
24. IF a Sabbatical_Leave applicant does not meet all eligibility criteria, THEN THE HRMS SHALL reject the application and return the specific unmet criteria.
25. WHEN a Sabbatical_Leave application is approved, THE HRMS SHALL grant 1 year of Sabbatical_Leave at full pay.

**Other Leaves (Article 75)**

26. WHEN an Employee submits a leave application for attendance at seminars, workshops, or short courses, THE HRMS SHALL grant the requested leave days subject to a maximum of 30 academic calendar days per year, with HR_Officer approval.

---

### Requirement 10: Performance Appraisal

**User Story:** As an HR_Officer, I want to evaluate employee performance and share results with employees, so that staff receive structured feedback on their work.

#### Acceptance Criteria

1. WHEN an HR_Officer creates a performance evaluation for an Employee, THE HRMS SHALL record the evaluation period, efficiency score, and work output score.
2. WHEN an HR_Officer saves a completed evaluation, THE HRMS SHALL notify the evaluated Employee that a new appraisal result is available.
3. WHEN an Employee views their appraisal result, THE HRMS SHALL present the data in read-only format; the Employee SHALL NOT be able to modify the evaluation.
4. THE HRMS SHALL restrict performance evaluation creation and editing to HR_Officer and Admin roles.

---

### Requirement 11: Training & Learning Management

**User Story:** As an HR_Officer, I want to assign training programs to employees and track completion, so that skill gaps are identified and addressed systematically.

#### Acceptance Criteria

1. WHEN an HR_Officer assigns a training program to an Employee, THE HRMS SHALL record the training title, assigned date, and expected completion date.
2. WHEN an Employee completes a training program, THE HRMS SHALL record the completion date and update the training status to "Completed".
3. THE HRMS SHALL generate a skill gap report per Employee by comparing the required competencies for the Employee's role against the Employee's completed training records.

---

### Requirement 12: Financial Reporting & HR–Finance Integration

**User Story:** As an HR_Officer, I want to generate and export payroll reports for the Finance department, so that salary and penalty data is delivered accurately and on time.

#### Acceptance Criteria

1. WHEN an HR_Officer generates a payroll report, THE HRMS SHALL compile salary and bonus data for all active employees in the selected period.
2. THE HRMS SHALL support export of salary and bonus data in Excel format.
3. THE HRMS SHALL support export of penalty data in a document format (PDF or DOCX).
4. WHEN a Finance_Actor requests HR data, THE HRMS SHALL allow an HR_Officer to generate and send the report to the Finance_Actor.
5. WHEN a Finance_Actor receives a report, THE HRMS SHALL allow the Finance_Actor to validate the data and record a validation status.

---

### Requirement 13: Exit, Clearance & Offboarding

**User Story:** As an HR_Officer, I want to manage the employee exit process through a structured clearance workflow, so that all departmental obligations are settled before an employee leaves.

#### Acceptance Criteria

1. WHEN an Employee submits a resignation or an HR_Officer initiates a separation, THE HRMS SHALL create a clearance record and set its status to "In Progress".
2. WHEN a clearance record is created, THE HRMS SHALL generate clearance tasks for ALL configured Clearance_Bodies (e.g., Library, IT, Finance, Store, Lab, Sport, Security, and any other configured body), regardless of the employee's campus associations.
3. THE HRMS SHALL support two clearance approval modes per Clearance_Body: Sequential (the next task becomes active only after the previous task is approved) and Parallel (the task can be approved independently of other tasks).
4. A Super_Admin or Admin SHALL be able to configure the list of Clearance_Bodies, their approval order, and whether each body requires Sequential or Parallel approval.
5. WHEN a Clearance_Body approves its clearance task, THE HRMS SHALL record the approver's identity and timestamp, and activate the next Sequential task if applicable.
6. WHEN a Clearance_Body rejects its clearance task, THE HRMS SHALL record the rejection reason, notify the Employee, and allow the Employee to re-submit the task after addressing the reason.
7. WHEN all clearance tasks are approved, THE HRMS SHALL set the overall clearance status to "Completed".

---

### Requirement 14: Experience Letter Generation

**User Story:** As an HR_Officer, I want to generate experience letters for departing employees, so that employees receive official documentation of their service.

#### Acceptance Criteria

1. WHEN an HR_Officer requests an experience letter for an Employee, THE HRMS SHALL auto-populate the letter with the Employee's full name, most recent position title, and total duration of employment (start date to end date).
2. THE HRMS SHALL generate the experience letter in a downloadable document format (PDF or DOCX).
3. THE HRMS SHALL restrict experience letter generation to the HR_Officer role only.

---

### Requirement 15: Account Deactivation & Record Preservation

**User Story:** As a Super_Admin, I want employee accounts to be automatically deactivated after clearance is complete, so that system access is revoked promptly while historical records are retained.

#### Acceptance Criteria

1. WHEN the clearance status for an Employee is set to "Completed", THE HRMS SHALL automatically set the Employee's account status to "Inactive" and revoke all active sessions.
2. WHEN an Employee account is deactivated, THE HRMS SHALL preserve all historical records associated with the Employee, including employment history, appraisals, training records, and payroll data.
3. WHILE an Employee account is "Inactive", THE HRMS SHALL deny all login attempts for that account and return an appropriate error message.
4. THE HRMS SHALL allow a Super_Admin to retrieve the full historical record of a deactivated Employee at any time.

---

### Requirement 16: System-Wide Activity Logging

**User Story:** As a Super_Admin, I want every action performed in the system to be recorded in an activity log, so that I can audit user behaviour, investigate incidents, and maintain accountability across all modules.

#### Acceptance Criteria

1. THE HRMS SHALL record an Activity_Log entry for every state-changing action performed by any user, including but not limited to: login, logout, profile creation, profile update, document upload, role assignment, privilege change, leave application, leave approval/rejection, recruitment stage transition, onboarding step completion, performance evaluation save, training assignment, payroll report generation, clearance task approval/rejection, experience letter generation, and account deactivation.
2. EACH Activity_Log entry SHALL capture: the acting user's Employee_ID and role, the action type, the target resource type and identifier, the previous state (where applicable), the new state (where applicable), the timestamp (UTC), and the originating IP address.
3. THE HRMS SHALL make Activity_Log entries immutable after creation; no user, including Super_Admin, SHALL be able to edit or delete a log entry.
4. WHEN a Super_Admin or HR_Officer views the activity log, THE HRMS SHALL support filtering by user, action type, resource type, date range, and campus.
5. THE HRMS SHALL retain Activity_Log entries for a minimum of 5 years.
6. WHEN an Employee's account is deactivated, THE HRMS SHALL preserve all Activity_Log entries associated with that Employee.
