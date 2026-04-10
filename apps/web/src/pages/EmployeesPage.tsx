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

function EmployeeForm({ employee, onClose }: { employee: Employee | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    fullName: employee?.fullName ?? "",
    dateOfBirth: employee?.dateOfBirth?.slice(0, 10) ?? "",
    gender: employee?.gender ?? "MALE",
    nationality: employee?.nationality ?? "",
    contactInfo: JSON.stringify(employee?.contactInfo ?? {}),
    emergencyContact: JSON.stringify(employee?.emergencyContact ?? {}),
    academicRank: employee?.academicRank ?? "",
    campusId: "",
  });
  const [error, setError] = useState("");

  const save = useMutation({
    mutationFn: () => employee ? api.put(`/employees/${employee.id}`, { ...form, contactInfo: JSON.parse(form.contactInfo || "{}"), emergencyContact: JSON.parse(form.emergencyContact || "{}") }) : api.post("/employees", { ...form, contactInfo: JSON.parse(form.contactInfo || "{}"), emergencyContact: JSON.parse(form.emergencyContact || "{}") }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees"] }); onClose(); },
    onError: (e: any) => setError(e.response?.data?.error?.message ?? "Error"),
  });

  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField label="Full Name" value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} required />
      <TextField label="Date of Birth" type="date" value={form.dateOfBirth} onChange={e => setForm(p => ({ ...p, dateOfBirth: e.target.value }))} InputLabelProps={{ shrink: true }} required />
      <FormControl required>
        <InputLabel>Gender</InputLabel>
        <Select value={form.gender} label="Gender" onChange={e => setForm(p => ({ ...p, gender: e.target.value }))}>
          <MenuItem value="MALE">Male</MenuItem>
          <MenuItem value="FEMALE">Female</MenuItem>
          <MenuItem value="OTHER">Other</MenuItem>
        </Select>
      </FormControl>
      <TextField label="Nationality" value={form.nationality} onChange={e => setForm(p => ({ ...p, nationality: e.target.value }))} required />
      <TextField label="Contact Info (JSON)" value={form.contactInfo} onChange={e => setForm(p => ({ ...p, contactInfo: e.target.value }))} required />
      <TextField label="Emergency Contact (JSON)" value={form.emergencyContact} onChange={e => setForm(p => ({ ...p, emergencyContact: e.target.value }))} required />
      <FormControl>
        <InputLabel>Academic Rank</InputLabel>
        <Select value={form.academicRank} label="Academic Rank" onChange={e => setForm(p => ({ ...p, academicRank: e.target.value }))}>
          <MenuItem value="">None</MenuItem>
          {RANKS.map(r => <MenuItem key={r} value={r}>{r.replace(/_/g, " ")}</MenuItem>)}
        </Select>
      </FormControl>
      {!employee && <TextField label="Campus ID" value={form.campusId} onChange={e => setForm(p => ({ ...p, campusId: e.target.value }))} required />}
      <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
    </Stack>
  );
}

function RoleForm({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const qc = useQueryClient();
  const [role, setRole] = useState("EMPLOYEE");
  const [privilege, setPrivilege] = useState("");
  const [error, setError] = useState("");

  const saveRole = useMutation({ mutationFn: () => api.put(`/employees/${employee.id}/role`, { baseRole: role }), onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }), onError: (e: any) => setError(e.response?.data?.error?.message ?? "Error") });
  const savePriv = useMutation({ mutationFn: () => api.put(`/employees/${employee.id}/privilege`, { specialPrivilege: privilege || null }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees"] }); onClose(); }, onError: (e: any) => setError(e.response?.data?.error?.message ?? "Error") });

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

function HistoryDialog({ employeeId, onClose }: { employeeId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery<{ data: HistoryEntry[] }>({ queryKey: ["history", employeeId], queryFn: () => api.get(`/employees/${employeeId}/history`).then(r => r.data) });
  const entries: HistoryEntry[] = data?.data ?? [];
  return (
    <>
      <DialogContent>
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
    onError: (e: any, id) => setActivateError({ id, msg: e.response?.data?.error?.message ?? "Activation failed" }),
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

      {error && <Alert severity="error" sx={{ mb: 2 }}>Failed to load employees</Alert>}
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
        <DialogTitle>Assign Role & Privilege</DialogTitle>
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
