import React, { useState } from "react";
import {
  Box, Typography, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Alert, Stack, Chip, MenuItem, Select, InputLabel, FormControl,
} from "@mui/material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/axios.js";
import { useAuth } from "../contexts/AuthContext.js";

interface Employee {
  id: string; employeeId: string; fullName: string; status: string;
  gender: string; nationality: string; dateOfBirth: string;
  contactInfo: unknown; emergencyContact: unknown; academicRank: string;
  departmentId: string;
}
interface HistoryEntry { id: string; changeType: string; previousValue: string; newValue: string; changedAt: string; }

const RANKS = ["LECTURER", "ASSISTANT_PROFESSOR", "ASSOCIATE_PROFESSOR"];

// ─── Validation helpers ───────────────────────────────────────────────────────

/** International phone: optional +, then 7–20 digits/spaces/dashes. */
const PHONE_RE = /^\+?[\d\s\-().]{7,20}$/;
/** Basic email sanity check. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validatePhone(v: string): string | undefined {
  if (!v.trim()) return "Phone number is required.";
  if (!PHONE_RE.test(v.trim())) return "Enter a valid phone number (e.g. +251 911 123456).";
}
function validateEmail(v: string): string | undefined {
  if (!v.trim()) return "Email address is required.";
  if (!EMAIL_RE.test(v.trim())) return "Enter a valid email address (e.g. name@example.com).";
}
function validateRequired(label: string, v: string): string | undefined {
  if (!v.trim()) return `${label} is required.`;
}

// ─── Structured contact helpers ───────────────────────────────────────────────

interface ContactFields   { phone: string; email: string; }
interface EmergencyFields { name: string; relationship: string; phone: string; }

function parseContactInfo(raw: unknown): ContactFields {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    return { phone: String(r.phone ?? ""), email: String(r.email ?? "") };
  }
  return { phone: "", email: "" };
}

function parseEmergencyContact(raw: unknown): EmergencyFields {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    return {
      name: String(r.name ?? ""),
      relationship: String(r.relationship ?? ""),
      phone: String(r.phone ?? ""),
    };
  }
  return { name: "", relationship: "", phone: "" };
}

// ─── EmployeeForm ─────────────────────────────────────────────────────────────

function EmployeeForm({ employee, onClose }: { employee: Employee | null; onClose: () => void }) {
  const qc = useQueryClient();

  const [form, setForm] = useState({
    fullName:    employee?.fullName ?? "",
    dateOfBirth: employee?.dateOfBirth?.slice(0, 10) ?? "",
    gender:      employee?.gender ?? "MALE",
    nationality: employee?.nationality ?? "",
    academicRank: employee?.academicRank ?? "",
    campusId: "",
  });

  // Structured contact info — replaces the old "Contact Info (JSON)" textarea
  const [contact, setContact] = useState<ContactFields>(
    parseContactInfo(employee?.contactInfo)
  );

  // Structured emergency contact — replaces the old "Emergency Contact (JSON)" textarea
  const [emergency, setEmergency] = useState<EmergencyFields>(
    parseEmergencyContact(employee?.emergencyContact)
  );

  // Only show validation messages after the user has touched a field or tried to submit
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [apiError, setApiError] = useState("");

  // ── All field validation rules ——————————————————————————————————————
  // Each field is validated independently; errors only surface on the
  // relevant field after blur or after a submit attempt.
  const errs = {
    // Core profile
    fullName:       validateRequired("Full name", form.fullName),
    dateOfBirth:    !form.dateOfBirth ? "Date of birth is required." : undefined,
    nationality:    validateRequired("Nationality", form.nationality),
    campusId:       (!employee && !form.campusId.trim()) ? "Campus ID is required." : undefined,
    // Contact details
    contactPhone:   validatePhone(contact.phone),
    contactEmail:   validateEmail(contact.email),
    // Emergency contact
    emergencyName:  validateRequired("Emergency contact name", emergency.name),
    emergencyRel:   validateRequired("Relationship", emergency.relationship),
    emergencyPhone: validatePhone(emergency.phone),
  } as const;
  const hasErrors = Object.values(errs).some(Boolean);

  // Show an error only when the field has been touched or submit was attempted
  const show = (field: keyof typeof errs) =>
    (touched[field] || submitAttempted) ? errs[field] : undefined;

  const touch = (field: string) => setTouched(p => ({ ...p, [field]: true }));

  const save = useMutation({
    mutationFn: () => {
      const contactInfo = {
        phone: contact.phone.trim(),
        email: contact.email.trim(),
      };
      const emergencyContact = {
        name:         emergency.name.trim(),
        relationship: emergency.relationship.trim(),
        phone:        emergency.phone.trim(),
      };
      const payload = { ...form, contactInfo, emergencyContact };
      return employee
        ? api.put(`/employees/${employee.id}`, payload)
        : api.post("/employees", payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees"] }); onClose(); },
    onError: (e: any) => setApiError(
      e.response?.data?.error?.message ??
      "Unable to save employee. Check your input and try again, or contact support."
    ),
  });

  const handleSave = () => {
    setSubmitAttempted(true);
    if (hasErrors) return;
    setApiError("");
    save.mutate();
  };

  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      {apiError && (
        <Alert severity="error" action={<Button size="small" onClick={handleSave}>Retry</Button>}>
          {apiError}
        </Alert>
      )}

      {/* ── Core profile ─────────────────────────────────────────────────── */}
      <TextField
        label="Full Name"
        value={form.fullName}
        onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))}
        onBlur={() => touch("fullName")}
        error={!!show("fullName")}
        helperText={show("fullName") ?? "First and last name"}
        required
      />
      <TextField
        label="Date of Birth"
        type="date"
        value={form.dateOfBirth}
        onChange={e => setForm(p => ({ ...p, dateOfBirth: e.target.value }))}
        onBlur={() => touch("dateOfBirth")}
        error={!!show("dateOfBirth")}
        helperText={show("dateOfBirth")}
        InputLabelProps={{ shrink: true }}
        required
      />
      <FormControl required>
        <InputLabel>Gender</InputLabel>
        <Select value={form.gender} label="Gender" onChange={e => setForm(p => ({ ...p, gender: e.target.value }))}>
          <MenuItem value="MALE">Male</MenuItem>
          <MenuItem value="FEMALE">Female</MenuItem>
          <MenuItem value="OTHER">Other</MenuItem>
        </Select>
      </FormControl>
      <TextField
        label="Nationality"
        value={form.nationality}
        onChange={e => setForm(p => ({ ...p, nationality: e.target.value }))}
        onBlur={() => touch("nationality")}
        error={!!show("nationality")}
        helperText={show("nationality") ?? "e.g. Ethiopian"}
        required
      />

      {/* ── Contact details ───────────────────────────────────────────────── */}
      <Typography variant="subtitle2" color="text.secondary" sx={{ pt: 1, pb: 0 }}>
        Contact Details
      </Typography>
      <TextField
        label="Phone Number"
        placeholder="+251 911 123456"
        value={contact.phone}
        onChange={e => setContact(p => ({ ...p, phone: e.target.value }))}
        onBlur={() => touch("contactPhone")}
        error={!!show("contactPhone")}
        helperText={show("contactPhone") ?? "Include the country code, e.g. +251 911 123456"}
        required
        inputProps={{ inputMode: "tel" }}
      />
      <TextField
        label="Email Address"
        placeholder="abebe@bdu.edu.et"
        value={contact.email}
        onChange={e => setContact(p => ({ ...p, email: e.target.value }))}
        onBlur={() => touch("contactEmail")}
        error={!!show("contactEmail")}
        helperText={show("contactEmail") ?? "Work or personal email address"}
        required
        inputProps={{ inputMode: "email" }}
      />

      {/* ── Emergency contact ─────────────────────────────────────────────── */}
      <Typography variant="subtitle2" color="text.secondary" sx={{ pt: 1, pb: 0 }}>
        Emergency Contact
      </Typography>
      <TextField
        label="Full Name"
        placeholder="Almaz Tadesse"
        value={emergency.name}
        onChange={e => setEmergency(p => ({ ...p, name: e.target.value }))}
        onBlur={() => touch("emergencyName")}
        error={!!show("emergencyName")}
        helperText={show("emergencyName") ?? "Name of the person to call in an emergency"}
        required
      />
      <TextField
        label="Relationship to Employee"
        placeholder="e.g. Spouse, Parent, Sibling"
        value={emergency.relationship}
        onChange={e => setEmergency(p => ({ ...p, relationship: e.target.value }))}
        onBlur={() => touch("emergencyRel")}
        error={!!show("emergencyRel")}
        helperText={show("emergencyRel") ?? "How this person is related to the employee"}
        required
      />
      <TextField
        label="Emergency Phone Number"
        placeholder="+251 911 654321"
        value={emergency.phone}
        onChange={e => setEmergency(p => ({ ...p, phone: e.target.value }))}
        onBlur={() => touch("emergencyPhone")}
        error={!!show("emergencyPhone")}
        helperText={show("emergencyPhone") ?? "Include the country code, e.g. +251 911 654321"}
        required
        inputProps={{ inputMode: "tel" }}
      />

      {/* ── Academic rank ──────────────────────────────────────────────────── */}
      <FormControl>
        <InputLabel>Academic Rank</InputLabel>
        <Select value={form.academicRank} label="Academic Rank" onChange={e => setForm(p => ({ ...p, academicRank: e.target.value }))}>
          <MenuItem value="">None</MenuItem>
          {RANKS.map(r => <MenuItem key={r} value={r}>{r.replace(/_/g, " ")}</MenuItem>)}
        </Select>
      </FormControl>
      {!employee && (
        <TextField
          label="Campus ID"
          value={form.campusId}
          onChange={e => setForm(p => ({ ...p, campusId: e.target.value }))}
          onBlur={() => touch("campusId")}
          error={!!show("campusId")}
          helperText={show("campusId") ?? "The campus this employee belongs to"}
          required
        />
      )}
      <Button variant="contained" onClick={handleSave} disabled={save.isPending}>
        Save
      </Button>
    </Stack>
  );
}

// ─── RoleForm ─────────────────────────────────────────────────────────────────

function RoleForm({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const qc = useQueryClient();
  const [role, setRole] = useState("EMPLOYEE");
  const [privilege, setPrivilege] = useState("");
  const [error, setError] = useState("");

  const saveRole = useMutation({
    mutationFn: () => api.put(`/employees/${employee.id}/role`, { baseRole: role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
    onError: (e: any) => setError(
      e.response?.data?.error?.message ??
      "Unable to update role. Please try again or contact your administrator."
    ),
  });
  const savePriv = useMutation({
    mutationFn: () => api.put(`/employees/${employee.id}/privilege`, { specialPrivilege: privilege || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees"] }); onClose(); },
    onError: (e: any) => setError(
      e.response?.data?.error?.message ??
      "Unable to update privilege. Please try again or contact your administrator."
    ),
  });

  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <FormControl>
        <InputLabel>Role</InputLabel>
        <Select value={role} label="Role" onChange={e => setRole(e.target.value)}>
          {["SUPER_ADMIN", "ADMIN", "HR_OFFICER", "EMPLOYEE"].map(r => <MenuItem key={r} value={r}>{r.replace(/_/g, " ")}</MenuItem>)}
        </Select>
      </FormControl>
      <FormControl>
        <InputLabel>Special Privilege</InputLabel>
        <Select value={privilege} label="Special Privilege" onChange={e => setPrivilege(e.target.value)}>
          <MenuItem value="">None</MenuItem>
          {["UNIVERSITY_PRESIDENT", "VICE_PRESIDENT", "DEAN", "DIRECTOR"].map(p => <MenuItem key={p} value={p}>{p.replace(/_/g, " ")}</MenuItem>)}
        </Select>
      </FormControl>
      <Stack direction="row" spacing={1}>
        <Button variant="outlined" onClick={() => saveRole.mutate()} disabled={saveRole.isPending}>Save Role</Button>
        <Button variant="contained" onClick={() => savePriv.mutate()} disabled={savePriv.isPending}>Save Privilege</Button>
      </Stack>
    </Stack>
  );
}

// ─── HistoryDialog ────────────────────────────────────────────────────────────

function HistoryDialog({ employeeId, onClose }: { employeeId: string; onClose: () => void }) {
  const { data, isLoading, error } = useQuery<{ data: HistoryEntry[] }>({ queryKey: ["history", employeeId], queryFn: () => api.get(`/employees/${employeeId}/history`).then(r => r.data) });
  const entries: HistoryEntry[] = data?.data ?? [];
  return (
    <>
      <DialogContent>
        {error && (
          <Alert severity="error">
            Failed to load employment history. Try closing and reopening this dialog.
          </Alert>
        )}
        {isLoading ? <Typography>Loading...</Typography> : (
          <Table size="small">
            <TableHead><TableRow><TableCell>Change</TableCell><TableCell>Previous</TableCell><TableCell>New</TableCell><TableCell>Date</TableCell></TableRow></TableHead>
            <TableBody>{entries.map(e => (
              <TableRow key={e.id}>
                <TableCell>{e.changeType}</TableCell>
                <TableCell>{e.previousValue}</TableCell>
                <TableCell>{e.newValue}</TableCell>
                <TableCell>{new Date(e.changedAt).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
    </>
  );
}

// ─── EmployeesPage ────────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [roleEmployee, setRoleEmployee] = useState<Employee | null>(null);
  const [historyEmployee, setHistoryEmployee] = useState<Employee | null>(null);
  const [activateError, setActivateError] = useState<{ id: string; msg: string } | null>(null);

  const canManage = user?.role !== "EMPLOYEE";
  const canAssignRoles = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";

  const { data, isLoading, error } = useQuery<{ data: Employee[] }>({
    queryKey: ["employees", search, statusFilter],
    queryFn: () => api.get("/employees", { params: { search: search || undefined, status: statusFilter || undefined } }).then(r => r.data),
  });

  const activate = useMutation({
    mutationFn: (id: string) => api.post(`/employees/${id}/activate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
    onError: (e: any, id) => setActivateError({
      id,
      msg: e.response?.data?.error?.message ??
        "Activation failed. Ensure all mandatory profile fields are complete and try again.",
    }),
  });

  const employees: Employee[] = data?.data ?? [];
  const statusColor = (s: string) => s === "ACTIVE" ? "success" : s === "INACTIVE" ? "error" : "default";

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Employees</Typography>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
        <TextField label="Search" size="small" value={search} onChange={e => setSearch(e.target.value)} />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} label="Status" onChange={e => setStatusFilter(e.target.value)}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="ACTIVE">Active</MenuItem>
            <MenuItem value="INACTIVE">Inactive</MenuItem>
            <MenuItem value="PENDING">Pending</MenuItem>
          </Select>
        </FormControl>
        {canManage && <Button variant="contained" onClick={() => setCreateOpen(true)}>Add Employee</Button>}
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}
          action={
            <Button size="small" color="inherit" onClick={() => qc.invalidateQueries({ queryKey: ["employees"] })}>
              Retry
            </Button>
          }
        >
          Failed to load employees. Check your connection and retry, or contact support.
        </Alert>
      )}
      {isLoading ? <Typography>Loading...</Typography> : (
        <Paper>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>ID</TableCell><TableCell>Name</TableCell><TableCell>Status</TableCell>
              <TableCell>Gender</TableCell><TableCell>Rank</TableCell><TableCell>Actions</TableCell>
            </TableRow></TableHead>
            <TableBody>{employees.map(emp => (
              <TableRow key={emp.id}>
                <TableCell>{emp.employeeId}</TableCell>
                <TableCell>{emp.fullName}</TableCell>
                <TableCell><Chip label={emp.status} color={statusColor(emp.status) as any} size="small" /></TableCell>
                <TableCell>{emp.gender}</TableCell>
                <TableCell>{emp.academicRank?.replace(/_/g, " ") ?? "—"}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap">
                    {canManage && <Button size="small" onClick={() => setEditEmployee(emp)}>Edit</Button>}
                    {canManage && emp.status !== "ACTIVE" && <Button size="small" color="success" onClick={() => activate.mutate(emp.id)}>Activate</Button>}
                    <Button size="small" onClick={() => setHistoryEmployee(emp)}>History</Button>
                    {canAssignRoles && <Button size="small" onClick={() => setRoleEmployee(emp)}>Roles</Button>}
                  </Stack>
                  {activateError?.id === emp.id && <Alert severity="error" sx={{ mt: 0.5 }}>{activateError.msg}</Alert>}
                </TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </Paper>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Employee</DialogTitle>
        <DialogContent><EmployeeForm employee={null} onClose={() => setCreateOpen(false)} /></DialogContent>
        <DialogActions><Button onClick={() => setCreateOpen(false)}>Cancel</Button></DialogActions>
      </Dialog>

      <Dialog open={!!editEmployee} onClose={() => setEditEmployee(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Employee</DialogTitle>
        <DialogContent>{editEmployee && <EmployeeForm employee={editEmployee} onClose={() => setEditEmployee(null)} />}</DialogContent>
        <DialogActions><Button onClick={() => setEditEmployee(null)}>Cancel</Button></DialogActions>
      </Dialog>

      <Dialog open={!!roleEmployee} onClose={() => setRoleEmployee(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Role &amp; Privilege</DialogTitle>
        <DialogContent>{roleEmployee && <RoleForm employee={roleEmployee} onClose={() => setRoleEmployee(null)} />}</DialogContent>
        <DialogActions><Button onClick={() => setRoleEmployee(null)}>Cancel</Button></DialogActions>
      </Dialog>

      <Dialog open={!!historyEmployee} onClose={() => setHistoryEmployee(null)} maxWidth="md" fullWidth>
        <DialogTitle>Employment History — {historyEmployee?.fullName}</DialogTitle>
        {historyEmployee && <HistoryDialog employeeId={historyEmployee.id} onClose={() => setHistoryEmployee(null)} />}
      </Dialog>
    </Box>
  );
}
