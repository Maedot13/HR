import React, { useState } from "react";
import {
  Box, Typography, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Alert, Stack, MenuItem, Select, InputLabel, FormControl,
} from "@mui/material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/axios.js";
import { useAuth } from "../contexts/AuthContext.js";

interface ScheduleEntry { id: string; employeeId: string; course: string; dayOfWeek: number; startTime: string; endTime: string; location: string; }

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function EntryForm({ entry, onClose }: { entry: ScheduleEntry | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState({ employeeId: entry?.employeeId ?? user?.userId ?? "", course: entry?.course ?? "", dayOfWeek: entry?.dayOfWeek ?? 1, startTime: entry?.startTime ?? "", endTime: entry?.endTime ?? "", location: entry?.location ?? "" });
  const [error, setError] = useState("");

  const save = useMutation({
    mutationFn: () => entry ? api.put(`/schedule/${entry.id}`, form) : api.post("/schedule", form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["schedule"] }); onClose(); },
    onError: (e: any) => setError(e.response?.data?.error?.message ?? "Unable to save this schedule entry. Check for time conflicts and try again."),
  });

  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField label="Employee ID" value={form.employeeId} onChange={e => setForm(p => ({ ...p, employeeId: e.target.value }))} required />
      <TextField label="Course" value={form.course} onChange={e => setForm(p => ({ ...p, course: e.target.value }))} required />
      <FormControl required>
        <InputLabel>Day</InputLabel>
        <Select value={form.dayOfWeek} label="Day" onChange={e => setForm(p => ({ ...p, dayOfWeek: Number(e.target.value) }))}>
          {DAYS.map((d, i) => <MenuItem key={i} value={i}>{d}</MenuItem>)}
        </Select>
      </FormControl>
      <TextField label="Start Time (HH:MM)" value={form.startTime} onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))} placeholder="08:00" required />
      <TextField label="End Time (HH:MM)" value={form.endTime} onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))} placeholder="10:00" required />
      <TextField label="Location" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} />
      <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
    </Stack>
  );
}

function SubstitutionForm({ entry, onClose }: { entry: ScheduleEntry; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ substituteId: "", sessionDate: "" });
  const [error, setError] = useState("");

  const save = useMutation({
    mutationFn: () => api.post(`/schedule/${entry.id}/substitution`, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["schedule"] }); onClose(); },
    onError: (e: any) => setError(e.response?.data?.error?.message ?? "Unable to record the substitution. Please verify the substitute employee ID and date, then try again."),
  });

  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField label="Substitute Employee ID" value={form.substituteId} onChange={e => setForm(p => ({ ...p, substituteId: e.target.value }))} required />
      <TextField label="Session Date" type="date" value={form.sessionDate} onChange={e => setForm(p => ({ ...p, sessionDate: e.target.value }))} InputLabelProps={{ shrink: true }} required />
      <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>Record Substitution</Button>
    </Stack>
  );
}

export default function TimetablePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isEmployee = user?.role === "EMPLOYEE";
  const [createOpen, setCreateOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<ScheduleEntry | null>(null);
  const [subEntry, setSubEntry] = useState<ScheduleEntry | null>(null);
  const [empFilter, setEmpFilter] = useState(user?.userId ?? "");
  const [searchId, setSearchId] = useState(user?.userId ?? "");

  const { data, isLoading, error } = useQuery<{ data: ScheduleEntry[] }>({
    queryKey: ["schedule", empFilter],
    queryFn: () => api.get(`/employees/${empFilter}/timetable`).then(r => r.data),
    enabled: !!empFilter,
  });

  const [deleteError, setDeleteError] = useState("");

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/schedule/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["schedule"] }); setDeleteError(""); },
    onError: (e: any) => setDeleteError(e.response?.data?.error?.message ?? "Unable to delete this entry. Please try again."),
  });

  const entries: ScheduleEntry[] = data?.data ?? [];
  const byDay: Record<number, ScheduleEntry[]> = {};
  for (let i = 0; i < 7; i++) byDay[i] = entries.filter(e => e.dayOfWeek === i);

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Timetable</Typography>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
        <TextField label="Employee ID" size="small" value={searchId} onChange={e => setSearchId(e.target.value)} />
        <Button variant="outlined" onClick={() => setEmpFilter(searchId)}>Load</Button>
        {!isEmployee && <Button variant="contained" onClick={() => setCreateOpen(true)}>Add Entry</Button>}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>Failed to load the timetable. Check your connection and try again.</Alert>}
      {deleteError && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button size="small" color="inherit" onClick={() => setDeleteError("")}>Dismiss</Button>}>
          {deleteError}
        </Alert>
      )}
      {isLoading ? <Typography>Loading...</Typography> : (
        <Paper sx={{ mb: 3, overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>{[1, 2, 3, 4, 5].map(d => <TableCell key={d} align="center"><strong>{DAYS[d]}</strong></TableCell>)}</TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                {[1, 2, 3, 4, 5].map(d => (
                  <TableCell key={d} sx={{ minWidth: 140, verticalAlign: "top" }}>
                    {(byDay[d] ?? []).map(e => (
                      <Paper key={e.id} variant="outlined" sx={{ p: 1, mb: 1 }}>
                        <Typography variant="caption" display="block">{e.startTime}–{e.endTime}</Typography>
                        <Typography variant="body2">{e.course}</Typography>
                        <Typography variant="caption" color="text.secondary">{e.location}</Typography>
                        {!isEmployee && (
                          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                            <Button size="small" onClick={() => setEditEntry(e)}>Edit</Button>
                            <Button size="small" color="error" onClick={() => del.mutate(e.id)}>Del</Button>
                            <Button size="small" onClick={() => setSubEntry(e)}>Sub</Button>
                          </Stack>
                        )}
                      </Paper>
                    ))}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </Paper>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Schedule Entry</DialogTitle>
        <DialogContent><EntryForm entry={null} onClose={() => setCreateOpen(false)} /></DialogContent>
        <DialogActions><Button onClick={() => setCreateOpen(false)}>Cancel</Button></DialogActions>
      </Dialog>

      <Dialog open={!!editEntry} onClose={() => setEditEntry(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Schedule Entry</DialogTitle>
        <DialogContent>{editEntry && <EntryForm entry={editEntry} onClose={() => setEditEntry(null)} />}</DialogContent>
        <DialogActions><Button onClick={() => setEditEntry(null)}>Cancel</Button></DialogActions>
      </Dialog>

      <Dialog open={!!subEntry} onClose={() => setSubEntry(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Record Substitution</DialogTitle>
        <DialogContent>{subEntry && <SubstitutionForm entry={subEntry} onClose={() => setSubEntry(null)} />}</DialogContent>
        <DialogActions><Button onClick={() => setSubEntry(null)}>Cancel</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
