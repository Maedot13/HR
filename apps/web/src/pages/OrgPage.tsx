import React, { useState } from "react";
import {
  Box, Typography, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Alert, Stack, Tabs, Tab,
} from "@mui/material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/axios.js";
import { useAuth } from "../contexts/AuthContext.js";
import { useWithCache } from "../hooks/useWithCache.js";

interface Campus    { id: string; code: string; name: string; }
interface College   { id: string; name: string; campusId: string; }
interface Department { id: string; name: string; collegeId: string; }
interface Unit      { id: string; name: string; departmentId: string; }

// ─── CampusesTab ──────────────────────────────────────────────────────────────

function CampusesTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Campus | null>(null);
  const [form, setForm] = useState({ code: "", name: "" });
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery<{ data: Campus[] }>({
    queryKey: ["campuses"],
    queryFn: () => api.get("/campuses").then(r => r.data),
  });

  const save = useMutation({
    mutationFn: () =>
      editing ? api.put(`/campuses/${editing.id}`, { name: form.name }) : api.post("/campuses", form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["campuses"] }); setOpen(false); },
    onError: (e: any) => setError(
      e.response?.data?.error?.message ??
      "Unable to save campus. Check the details and try again."
    ),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/campuses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campuses"] }),
    onError: (e: any) => setError(
      e.response?.data?.error?.message ??
      "Unable to delete campus. It may still have colleges or employees linked to it."
    ),
  });

  const campuses: Campus[] = data?.data ?? [];

  return (
    <Box>
      {isSuperAdmin && (
        <Button
          variant="contained"
          onClick={() => { setEditing(null); setForm({ code: "", name: "" }); setError(""); setOpen(true); }}
          sx={{ mb: 2 }}
        >
          Add Campus
        </Button>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" color="inherit" onClick={() => setError("")}>Dismiss</Button>}>
          {error}
        </Alert>
      )}
      {isLoading ? <Typography>Loading...</Typography> : (
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>Code</TableCell><TableCell>Name</TableCell>
            {isSuperAdmin && <TableCell>Actions</TableCell>}
          </TableRow></TableHead>
          <TableBody>{campuses.map(c => (
            <TableRow key={c.id}>
              <TableCell>{c.code}</TableCell>
              <TableCell>{c.name}</TableCell>
              {isSuperAdmin && (
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    <Button size="small" onClick={() => { setEditing(c); setForm({ code: c.code, name: c.name }); setError(""); setOpen(true); }}>
                      Edit
                    </Button>
                    <Button size="small" color="error" onClick={() => del.mutate(c.id)} disabled={del.isPending}>
                      Delete
                    </Button>
                  </Stack>
                </TableCell>
              )}
            </TableRow>
          ))}</TableBody>
        </Table>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? "Edit Campus" : "Create Campus"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Campus Code"
              value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
              disabled={!!editing}
              required
              helperText={editing ? "Campus code cannot be changed" : ""}
            />
            <TextField label="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── CollegesTab ──────────────────────────────────────────────────────────────

function CollegesTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<College | null>(null);
  const [form, setForm] = useState({ name: "", campusId: "" });
  const [error, setError] = useState("");

  // ── Tier 1→2→3 fallback for campuses dropdown ────────────────────────────────
  const campusQuery = useQuery<{ data: Campus[] }>({
    queryKey: ["campuses"],
    queryFn: () => api.get("/campuses").then(r => r.data),
  });
  const {
    resolvedData: campusResolved,
    isFromCache:  campusFromCache,
    isManualFallback: campusFallback,
  } = useWithCache("campuses", campusQuery);
  const campuses: Campus[] = campusResolved?.data ?? [];

  const { data, isLoading } = useQuery<{ data: College[] }>({
    queryKey: ["colleges"],
    queryFn: async () => {
      const all = await Promise.all(campuses.map(c => api.get(`/campuses/${c.id}/colleges`).then(r => r.data.data ?? [])));
      return { data: all.flat() };
    },
    enabled: campuses.length > 0,
  });

  const save = useMutation({
    mutationFn: () =>
      editing
        ? api.put(`/colleges/${editing.id}`, { name: form.name })
        : api.post(`/campuses/${form.campusId}/colleges`, { name: form.name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["colleges"] }); setOpen(false); },
    onError: (e: any) => setError(
      e.response?.data?.error?.message ??
      "Unable to save college. Check the details and try again."
    ),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/colleges/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["colleges"] }),
    onError: (e: any) => setError(
      e.response?.data?.error?.message ??
      "Unable to delete college. It may still have departments linked to it."
    ),
  });

  const colleges: College[] = data?.data ?? [];

  return (
    <Box>
      {/* Add button always enabled — the dialog adapts to the available tier */}
      <Button
        variant="contained"
        onClick={() => { setEditing(null); setForm({ name: "", campusId: campuses[0]?.id ?? "" }); setError(""); setOpen(true); }}
        sx={{ mb: 2 }}
      >
        Add College
      </Button>
      {/* Tier 2 banner: stale cache in use */}
      {campusFromCache && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Showing saved campus list from your last session. It may not reflect recent changes — check your connection to refresh.
        </Alert>
      )}
      {/* Tier 3 banner: no cache, manual input in the dialog */}
      {campusFallback && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          The campus list could not be loaded. You can still add a college by entering the Campus ID manually.
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" color="inherit" onClick={() => setError("")}>Dismiss</Button>}>
          {error}
        </Alert>
      )}
      {isLoading ? <Typography>Loading...</Typography> : (
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>Name</TableCell><TableCell>Campus</TableCell><TableCell>Actions</TableCell>
          </TableRow></TableHead>
          <TableBody>{colleges.map(c => (
            <TableRow key={c.id}>
              <TableCell>{c.name}</TableCell>
              <TableCell>{campuses.find(x => x.id === c.campusId)?.name ?? c.campusId}</TableCell>
              <TableCell>
                <Stack direction="row" spacing={0.5}>
                  <Button size="small" onClick={() => { setEditing(c); setForm({ name: c.name, campusId: c.campusId }); setError(""); setOpen(true); }}>Edit</Button>
                  <Button size="small" color="error" onClick={() => del.mutate(c.id)} disabled={del.isPending}>Delete</Button>
                </Stack>
              </TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? "Edit College" : "Create College"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            {!editing && (
              campusFallback ? (
                // Tier 3: API failed, no cache — manual text entry
                <TextField
                  label="Campus ID (type manually — list unavailable)"
                  value={form.campusId}
                  onChange={e => setForm(f => ({ ...f, campusId: e.target.value }))}
                  helperText="The campus list could not be loaded. Enter the Campus ID directly."
                  required
                />
              ) : (
                <>
                  {campusFromCache && (
                    <Alert severity="warning" sx={{ py: 0.5 }}>
                      Showing saved campus list — may not reflect recent changes.
                    </Alert>
                  )}
                  <TextField
                    select
                    label="Campus"
                    value={form.campusId}
                    onChange={e => setForm(f => ({ ...f, campusId: e.target.value }))}
                    SelectProps={{ native: true }}
                  >
                    {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </TextField>
                </>
              )
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── DepartmentsTab ───────────────────────────────────────────────────────────

function DepartmentsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState({ name: "", collegeId: "" });
  const [error, setError] = useState("");

  // ── Tier 1→2→3 fallback for campuses (needed to load colleges) ───────────────
  const campusQuery = useQuery<{ data: Campus[] }>({
    queryKey: ["campuses"],
    queryFn: () => api.get("/campuses").then(r => r.data),
  });
  const { resolvedData: campusResolved } = useWithCache("campuses", campusQuery);
  const campuses: Campus[] = campusResolved?.data ?? [];

  // ── Tier 1→2→3 fallback for colleges dropdown ────────────────────────────────
  const collegeQuery = useQuery<{ data: College[] }>({
    queryKey: ["colleges"],
    queryFn: async () => {
      const all = await Promise.all(campuses.map(c => api.get(`/campuses/${c.id}/colleges`).then(r => r.data.data ?? [])));
      return { data: all.flat() };
    },
    enabled: campuses.length > 0,
  });
  const {
    resolvedData: collegeResolved,
    isFromCache:  collegeFromCache,
    isManualFallback: collegeFallback,
  } = useWithCache("colleges", collegeQuery);
  const colleges: College[] = collegeResolved?.data ?? [];

  const { data, isLoading } = useQuery<{ data: Department[] }>({
    queryKey: ["departments"],
    queryFn: async () => {
      const all = await Promise.all(colleges.map(c => api.get(`/colleges/${c.id}/departments`).then(r => r.data.data ?? [])));
      return { data: all.flat() };
    },
    enabled: colleges.length > 0,
  });

  const save = useMutation({
    mutationFn: () =>
      editing
        ? api.put(`/departments/${editing.id}`, { name: form.name })
        : api.post(`/colleges/${form.collegeId}/departments`, { name: form.name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["departments"] }); setOpen(false); },
    onError: (e: any) => setError(
      e.response?.data?.error?.message ??
      "Unable to save department. Check the details and try again."
    ),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/departments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["departments"] }),
    onError: (e: any) => setError(
      e.response?.data?.error?.message ??
      "Unable to delete department. It may still have employees or units linked to it."
    ),
  });

  const departments: Department[] = data?.data ?? [];

  return (
    <Box>
      {/* Add button always enabled — the dialog adapts to the available tier */}
      <Button
        variant="contained"
        onClick={() => { setEditing(null); setForm({ name: "", collegeId: colleges[0]?.id ?? "" }); setError(""); setOpen(true); }}
        sx={{ mb: 2 }}
      >
        Add Department
      </Button>
      {collegeFromCache && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Showing saved college list from your last session. It may not reflect recent changes — check your connection to refresh.
        </Alert>
      )}
      {collegeFallback && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          The college list could not be loaded. You can still add a department by entering the College ID manually.
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" color="inherit" onClick={() => setError("")}>Dismiss</Button>}>
          {error}
        </Alert>
      )}
      {isLoading ? <Typography>Loading...</Typography> : (
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>Name</TableCell><TableCell>College</TableCell><TableCell>Actions</TableCell>
          </TableRow></TableHead>
          <TableBody>{departments.map(d => (
            <TableRow key={d.id}>
              <TableCell>{d.name}</TableCell>
              <TableCell>{colleges.find(c => c.id === d.collegeId)?.name ?? d.collegeId}</TableCell>
              <TableCell>
                <Stack direction="row" spacing={0.5}>
                  <Button size="small" onClick={() => { setEditing(d); setForm({ name: d.name, collegeId: d.collegeId }); setError(""); setOpen(true); }}>Edit</Button>
                  <Button size="small" color="error" onClick={() => del.mutate(d.id)} disabled={del.isPending}>Delete</Button>
                </Stack>
              </TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? "Edit Department" : "Create Department"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            {!editing && (
              collegeFallback ? (
                // Tier 3: no cache — allow manual text entry
                <TextField
                  label="College ID (type manually — list unavailable)"
                  value={form.collegeId}
                  onChange={e => setForm(f => ({ ...f, collegeId: e.target.value }))}
                  helperText="The college list could not be loaded. Enter the College ID directly."
                  required
                />
              ) : (
                <>
                  {collegeFromCache && (
                    <Alert severity="warning" sx={{ py: 0.5 }}>
                      Showing saved college list — may not reflect recent changes.
                    </Alert>
                  )}
                  <TextField
                    select
                    label="College"
                    value={form.collegeId}
                    onChange={e => setForm(f => ({ ...f, collegeId: e.target.value }))}
                    SelectProps={{ native: true }}
                  >
                    {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </TextField>
                </>
              )
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── UnitsTab ─────────────────────────────────────────────────────────────────

function UnitsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [form, setForm] = useState({ name: "", departmentId: "" });
  const [error, setError] = useState("");

  // ── Campus → College → Dept chain with full cache fallback at each tier ───────
  const campusQuery = useQuery<{ data: Campus[] }>({
    queryKey: ["campuses"],
    queryFn: () => api.get("/campuses").then(r => r.data),
  });
  const { resolvedData: campusResolved } = useWithCache("campuses", campusQuery);
  const campuses: Campus[] = campusResolved?.data ?? [];

  const collegeQuery = useQuery<{ data: College[] }>({
    queryKey: ["colleges"],
    queryFn: async () => {
      const all = await Promise.all(campuses.map(c => api.get(`/campuses/${c.id}/colleges`).then(r => r.data.data ?? [])));
      return { data: all.flat() };
    },
    enabled: campuses.length > 0,
  });
  const { resolvedData: collegeResolved } = useWithCache("colleges", collegeQuery);
  const colleges: College[] = collegeResolved?.data ?? [];

  const deptQuery = useQuery<{ data: Department[] }>({
    queryKey: ["departments"],
    queryFn: async () => {
      const all = await Promise.all(colleges.map(c => api.get(`/colleges/${c.id}/departments`).then(r => r.data.data ?? [])));
      return { data: all.flat() };
    },
    enabled: colleges.length > 0,
  });
  const {
    resolvedData: deptResolved,
    isFromCache:  deptFromCache,
    isManualFallback: deptFallback,
  } = useWithCache("departments", deptQuery);
  const departments: Department[] = deptResolved?.data ?? [];

  const { data, isLoading } = useQuery<{ data: Unit[] }>({
    queryKey: ["units"],
    queryFn: async () => {
      const all = await Promise.all(departments.map(d => api.get(`/departments/${d.id}/units`).then(r => r.data.data ?? [])));
      return { data: all.flat() };
    },
    enabled: departments.length > 0,
  });

  const save = useMutation({
    mutationFn: () =>
      editing
        ? api.put(`/units/${editing.id}`, { name: form.name })
        : api.post(`/departments/${form.departmentId}/units`, { name: form.name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["units"] }); setOpen(false); },
    onError: (e: any) => setError(
      e.response?.data?.error?.message ??
      "Unable to save unit. Check the details and try again."
    ),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/units/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["units"] }),
    onError: (e: any) => setError(
      e.response?.data?.error?.message ??
      "Unable to delete unit. It may still have employees linked to it."
    ),
  });

  const units: Unit[] = data?.data ?? [];

  return (
    <Box>
      {/* Add button always enabled — dialog adapts to available tier */}
      <Button
        variant="contained"
        onClick={() => { setEditing(null); setForm({ name: "", departmentId: departments[0]?.id ?? "" }); setError(""); setOpen(true); }}
        sx={{ mb: 2 }}
      >
        Add Unit
      </Button>
      {deptFromCache && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Showing saved department list from your last session. It may not reflect recent changes — check your connection to refresh.
        </Alert>
      )}
      {deptFallback && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          The department list could not be loaded. You can still add a unit by entering the Department ID manually.
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" color="inherit" onClick={() => setError("")}>Dismiss</Button>}>
          {error}
        </Alert>
      )}
      {isLoading ? <Typography>Loading...</Typography> : (
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>Name</TableCell><TableCell>Department</TableCell><TableCell>Actions</TableCell>
          </TableRow></TableHead>
          <TableBody>{units.map(u => (
            <TableRow key={u.id}>
              <TableCell>{u.name}</TableCell>
              <TableCell>{departments.find(d => d.id === u.departmentId)?.name ?? u.departmentId}</TableCell>
              <TableCell>
                <Stack direction="row" spacing={0.5}>
                  <Button size="small" onClick={() => { setEditing(u); setForm({ name: u.name, departmentId: u.departmentId }); setError(""); setOpen(true); }}>Edit</Button>
                  <Button size="small" color="error" onClick={() => del.mutate(u.id)} disabled={del.isPending}>Delete</Button>
                </Stack>
              </TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? "Edit Unit" : "Create Unit"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            {!editing && (
              deptFallback ? (
                // Tier 3: no cache — manual text entry
                <TextField
                  label="Department ID (type manually — list unavailable)"
                  value={form.departmentId}
                  onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))}
                  helperText="The department list could not be loaded. Enter the Department ID directly."
                  required
                />
              ) : (
                <>
                  {deptFromCache && (
                    <Alert severity="warning" sx={{ py: 0.5 }}>
                      Showing saved department list — may not reflect recent changes.
                    </Alert>
                  )}
                  <TextField
                    select
                    label="Department"
                    value={form.departmentId}
                    onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))}
                    SelectProps={{ native: true }}
                  >
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </TextField>
                </>
              )
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── OrgPage ──────────────────────────────────────────────────────────────────

export default function OrgPage() {
  const [tab, setTab] = useState(0);
  return (
    <Box>
      <Typography variant="h5" gutterBottom>Organizational Hierarchy</Typography>
      <Paper>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Campuses" /><Tab label="Colleges" /><Tab label="Departments" /><Tab label="Units" />
        </Tabs>
        <Box sx={{ p: 2 }}>
          {tab === 0 && <CampusesTab />}
          {tab === 1 && <CollegesTab />}
          {tab === 2 && <DepartmentsTab />}
          {tab === 3 && <UnitsTab />}
        </Box>
      </Paper>
    </Box>
  );
}
