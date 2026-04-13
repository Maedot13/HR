import React, { useState } from "react";
import {
  Box, Typography, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Alert, Stack, Chip, Tabs, Tab, MenuItem, Select, InputLabel, FormControl,
} from "@mui/material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/axios.js";
import { useAuth } from "../contexts/AuthContext.js";
import { useWithCache } from "../hooks/useWithCache.js";

interface TrainingProgram { id: string; title: string; description: string; competencies: string[]; }
interface TrainingAssignment { id: string; trainingProgramId: string; trainingProgram: { title: string }; assignedDate: string; expectedCompletion: string; completionDate?: string; status: string; }

function ProgramForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", description: "", competencies: "" });
  const [error, setError] = useState("");

  const save = useMutation({
    mutationFn: () =>
      api.post("/training/programs", {
        ...form,
        competencies: form.competencies.split(",").map(s => s.trim()).filter(Boolean),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["training-programs"] }); onClose(); },
    onError: (e: any) => setError(
      e.response?.data?.error?.message ??
      "Unable to create training program. Check the details and try again."
    ),
  });

  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField label="Title" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
      <TextField label="Description" multiline rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
      <TextField
        label="Competencies"
        placeholder="e.g. Leadership, Communication, Data Analysis"
        value={form.competencies}
        onChange={e => setForm(p => ({ ...p, competencies: e.target.value }))}
        helperText="Separate multiple competencies with commas"
      />
      <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>
        Create Program
      </Button>
    </Stack>
  );
}

function AssignForm({ employeeId, onClose }: { employeeId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ trainingProgramId: "", expectedCompletion: "" });
  const [error, setError] = useState("");

  // ── Tier 1→2→3 fallback for training programs ────────────────────────────────
  const programsQuery = useQuery<{ data: TrainingProgram[] }>({
    queryKey: ["training-programs"],
    queryFn: () => api.get("/training/programs").then(r => r.data),
  });
  const {
    resolvedData: programsResolved,
    isFromCache:  programsFromCache,
    isManualFallback: programsManual,
  } = useWithCache("training-programs", programsQuery);
  const programs: TrainingProgram[] = programsResolved?.data ?? [];

  const save = useMutation({
    mutationFn: () =>
      api.post(`/employees/${employeeId}/training`, {
        ...form,
        expectedCompletion: new Date(form.expectedCompletion).toISOString(),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["training-assignments", employeeId] }); onClose(); },
    onError: (e: any) => setError(
      e.response?.data?.error?.message ??
      "Unable to assign training. Check the details and try again."
    ),
  });

  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}
      {/* Tier 2: API failed but cache is available — show stale data with a warning */}
      {programsFromCache && (
        <Alert severity="warning">
          Showing saved training programs from your last session. The list may not include recently added programs.
        </Alert>
      )}
      {programsManual ? (
        // Tier 3: API failed AND no cache — allow manual text entry
        <TextField
          label="Program Name (type manually — list unavailable)"
          value={form.trainingProgramId}
          onChange={e => setForm(p => ({ ...p, trainingProgramId: e.target.value }))}
          helperText="The program list could not be loaded. Type the program name or ID directly."
          required
        />
      ) : (
        <FormControl required>
          <InputLabel>Program</InputLabel>
          <Select
            value={form.trainingProgramId}
            label="Program"
            onChange={e => setForm(p => ({ ...p, trainingProgramId: e.target.value }))}
          >
            {programs.map(p => <MenuItem key={p.id} value={p.id}>{p.title}</MenuItem>)}
          </Select>
        </FormControl>
      )}
      <TextField
        label="Expected Completion"
        type="date"
        value={form.expectedCompletion}
        onChange={e => setForm(p => ({ ...p, expectedCompletion: e.target.value }))}
        InputLabelProps={{ shrink: true }}
        required
      />
      {/* Submit is never disabled by API availability — user can always type a value */}
      <Button
        variant="contained"
        onClick={() => save.mutate()}
        disabled={save.isPending}
      >
        Assign
      </Button>
    </Stack>
  );
}

export default function TrainingPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [empId, setEmpId] = useState(user?.userId ?? "");
  const [searchId, setSearchId] = useState(user?.userId ?? "");
  // Error banner for markComplete — previously a silent failure
  const [completeError, setCompleteError] = useState("");

  const canManage = user?.role !== "EMPLOYEE";

  const { data: programsData, isLoading: programsLoading } = useQuery<{ data: TrainingProgram[] }>({
    queryKey: ["training-programs"],
    queryFn: () => api.get("/training/programs").then(r => r.data),
  });
  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery<{ data: TrainingAssignment[] }>({
    queryKey: ["training-assignments", empId],
    queryFn: () => api.get(`/employees/${empId}/training`).then(r => r.data),
    enabled: !!empId,
  });
  const { data: gapData } = useQuery<{ data: { required: string[]; completed: string[]; gaps: string[] } }>({
    queryKey: ["skill-gap", empId],
    queryFn: () => api.get(`/employees/${empId}/skill-gap`).then(r => r.data),
    enabled: !!empId,
  });

  const markComplete = useMutation({
    mutationFn: (id: string) => api.put(`/training/assignments/${id}/complete`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["training-assignments", empId] }); setCompleteError(""); },
    onError: (e: any) => setCompleteError(
      e.response?.data?.error?.message ??
      "Unable to mark training as complete. Please try again or contact support."
    ),
  });

  const programs: TrainingProgram[] = programsData?.data ?? [];
  const assignments: TrainingAssignment[] = assignmentsData?.data ?? [];
  const gap = gapData?.data;

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Training &amp; LMS</Typography>
      <Paper>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Programs" /><Tab label="Assignments" /><Tab label="Skill Gap" />
        </Tabs>
        <Box sx={{ p: 2 }}>
          {/* ── Programs tab ────────────────────────────────────────────── */}
          {tab === 0 && (
            <Box>
              {canManage && (
                <Button variant="contained" onClick={() => setCreateOpen(true)} sx={{ mb: 2 }}>
                  New Program
                </Button>
              )}
              {programsLoading ? <Typography>Loading...</Typography> : (
                <Table size="small">
                  <TableHead><TableRow>
                    <TableCell>Title</TableCell><TableCell>Description</TableCell><TableCell>Competencies</TableCell>
                  </TableRow></TableHead>
                  <TableBody>{programs.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>{p.title}</TableCell>
                      <TableCell>{p.description}</TableCell>
                      <TableCell>{p.competencies.join(", ")}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}
            </Box>
          )}

          {/* ── Assignments tab ─────────────────────────────────────────── */}
          {tab === 1 && (
            <Box>
              <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
                <TextField label="Employee ID" size="small" value={searchId} onChange={e => setSearchId(e.target.value)} />
                <Button variant="outlined" onClick={() => setEmpId(searchId)}>Load</Button>
                {canManage && (
                  <Button variant="contained" onClick={() => setAssignOpen(true)}>Assign Training</Button>
                )}
              </Stack>
              {completeError && (
                <Alert
                  severity="error"
                  sx={{ mb: 2 }}
                  action={<Button size="small" color="inherit" onClick={() => setCompleteError("")}>Dismiss</Button>}
                >
                  {completeError}
                </Alert>
              )}
              {assignmentsLoading ? <Typography>Loading...</Typography> : (
                <Table size="small">
                  <TableHead><TableRow>
                    <TableCell>Program</TableCell><TableCell>Assigned</TableCell><TableCell>Expected</TableCell>
                    <TableCell>Status</TableCell>{canManage && <TableCell>Actions</TableCell>}
                  </TableRow></TableHead>
                  <TableBody>{assignments.map(a => (
                    <TableRow key={a.id}>
                      <TableCell>{a.trainingProgram.title}</TableCell>
                      <TableCell>{new Date(a.assignedDate).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(a.expectedCompletion).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Chip
                          label={a.status}
                          color={a.status === "COMPLETED" ? "success" : "warning"}
                          size="small"
                        />
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          {a.status !== "COMPLETED" && (
                            <Button
                              size="small"
                              color="success"
                              onClick={() => markComplete.mutate(a.id)}
                              disabled={markComplete.isPending}
                            >
                              Mark Complete
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}
            </Box>
          )}

          {/* ── Skill Gap tab ────────────────────────────────────────────── */}
          {tab === 2 && (
            <Box>
              <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
                <TextField label="Employee ID" size="small" value={searchId} onChange={e => setSearchId(e.target.value)} />
                <Button variant="outlined" onClick={() => setEmpId(searchId)}>Load</Button>
              </Stack>
              {gap && (
                <Stack spacing={1}>
                  <Typography variant="subtitle2">
                    Completed Competencies: {gap.completed.join(", ") || "None"}
                  </Typography>
                  <Typography variant="subtitle2">
                    Gaps: {gap.gaps.join(", ") || "None"}
                  </Typography>
                </Stack>
              )}
            </Box>
          )}
        </Box>
      </Paper>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Training Program</DialogTitle>
        <DialogContent><ProgramForm onClose={() => setCreateOpen(false)} /></DialogContent>
        <DialogActions><Button onClick={() => setCreateOpen(false)}>Cancel</Button></DialogActions>
      </Dialog>

      <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Training</DialogTitle>
        <DialogContent><AssignForm employeeId={empId} onClose={() => setAssignOpen(false)} /></DialogContent>
        <DialogActions><Button onClick={() => setAssignOpen(false)}>Cancel</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
