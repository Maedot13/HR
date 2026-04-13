import React, { useState } from "react";
import {
  Box, Typography, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Alert, Stack, Chip,
} from "@mui/material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/axios.js";
import { useAuth } from "../contexts/AuthContext.js";

interface Evaluation { id: string; employeeId: string; evaluationPeriod: string; efficiencyScore: number; workOutputScore: number; createdAt: string; }

// Validates a score string: must be a number in 0–100
function validateScore(label: string, v: string): string | undefined {
  if (!v.trim()) return `${label} is required.`;
  const n = Number(v);
  if (isNaN(n)) return `${label} must be a number.`;
  if (n < 0 || n > 100) return `${label} must be between 0 and 100.`;
}
// Evaluation period: e.g. 2025-Q1, 2025-H1, 2025-01, 2025
const PERIOD_RE = /^\d{4}(-Q[1-4]|-H[12]|-\d{2})?$/;
function validatePeriod(v: string): string | undefined {
  if (!v.trim()) return "Evaluation period is required.";
  if (!PERIOD_RE.test(v.trim())) return "Use a format like 2025-Q1, 2025-H1, or 2025-03.";
}

function EvaluationForm({ evaluation, employeeId, onClose }: { evaluation: Evaluation | null; employeeId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    evaluationPeriod: evaluation?.evaluationPeriod ?? "",
    efficiencyScore:  evaluation?.efficiencyScore?.toString()  ?? "",
    workOutputScore:  evaluation?.workOutputScore?.toString()  ?? "",
  });
  const [apiError, setApiError] = useState("");

  // ── Per-field validation — each field knows its own error ────────────
  const errs = {
    evaluationPeriod: validatePeriod(form.evaluationPeriod),
    efficiencyScore:  validateScore("Efficiency score",  form.efficiencyScore),
    workOutputScore:  validateScore("Work output score", form.workOutputScore),
  } as const;

  const hasErrors = Object.values(errs).some(Boolean);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const show = (f: keyof typeof errs) => (touched[f] || submitAttempted) ? errs[f] : undefined;
  const touch = (f: string) => setTouched(p => ({ ...p, [f]: true }));

  const save = useMutation({
    mutationFn: () => evaluation
      ? api.put(`/evaluations/${evaluation.id}`, {
          ...form,
          efficiencyScore: Number(form.efficiencyScore),
          workOutputScore: Number(form.workOutputScore),
        })
      : api.post(`/employees/${employeeId}/evaluations`, {
          ...form,
          efficiencyScore: Number(form.efficiencyScore),
          workOutputScore: Number(form.workOutputScore),
        }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["evaluations", employeeId] }); onClose(); },
    onError: (e: any) => setApiError(
      e.response?.data?.error?.message ??
      "Unable to save evaluation. Check the scores and period format, then try again."
    ),
  });

  // Submit is only disabled while the API call is in-flight — not by validation state
  const handleSave = () => {
    setSubmitAttempted(true);
    if (hasErrors) return;
    setApiError("");
    save.mutate();
  };

  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      {/* API error is separate from field-level errors */}
      {apiError && <Alert severity="error">{apiError}</Alert>}
      <TextField
        label="Evaluation Period"
        placeholder="e.g. 2025-Q1"
        value={form.evaluationPeriod}
        onChange={e => setForm(p => ({ ...p, evaluationPeriod: e.target.value }))}
        onBlur={() => touch("evaluationPeriod")}
        error={!!show("evaluationPeriod")}
        helperText={show("evaluationPeriod") ?? "Format: YYYY-Q1, YYYY-H1, or YYYY-MM"}
        required
      />
      <TextField
        label="Efficiency Score"
        type="number"
        value={form.efficiencyScore}
        onChange={e => setForm(p => ({ ...p, efficiencyScore: e.target.value }))}
        onBlur={() => touch("efficiencyScore")}
        error={!!show("efficiencyScore")}
        helperText={show("efficiencyScore") ?? "Enter a number from 0 to 100"}
        inputProps={{ min: 0, max: 100, step: 1 }}
        required
      />
      <TextField
        label="Work Output Score"
        type="number"
        value={form.workOutputScore}
        onChange={e => setForm(p => ({ ...p, workOutputScore: e.target.value }))}
        onBlur={() => touch("workOutputScore")}
        error={!!show("workOutputScore")}
        helperText={show("workOutputScore") ?? "Enter a number from 0 to 100"}
        inputProps={{ min: 0, max: 100, step: 1 }}
        required
      />
      {/* Never disabled by validation — clicking always triggers submit attempt */}
      <Button variant="contained" onClick={handleSave} disabled={save.isPending}>Save</Button>
    </Stack>
  );
}

export default function AppraisalPage() {
  const { user } = useAuth();
  const [empId, setEmpId] = useState(user?.userId ?? "");
  const [searchId, setSearchId] = useState(user?.userId ?? "");
  const [createOpen, setCreateOpen] = useState(false);
  const [editEval, setEditEval] = useState<Evaluation | null>(null);

  const canManage = user?.role !== "EMPLOYEE";

  const { data, isLoading, error } = useQuery<{ data: Evaluation[] }>({
    queryKey: ["evaluations", empId],
    queryFn: () => api.get(`/employees/${empId}/evaluations`).then(r => r.data),
    enabled: !!empId,
  });

  const evaluations: Evaluation[] = data?.data ?? [];
  const scoreColor = (s: number) => s >= 80 ? "success" : s >= 60 ? "warning" : "error";

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Performance Appraisal</Typography>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
        {canManage && (
          <>
            <TextField label="Employee ID" size="small" value={searchId} onChange={e => setSearchId(e.target.value)} />
            <Button variant="outlined" onClick={() => setEmpId(searchId)}>Load</Button>
            {empId && <Button variant="contained" onClick={() => setCreateOpen(true)}>New Evaluation</Button>}
          </>
        )}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>Failed to load evaluations</Alert>}
      {isLoading ? <Typography>Loading...</Typography> : (
        <Paper>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>Period</TableCell><TableCell>Efficiency</TableCell><TableCell>Work Output</TableCell>
              <TableCell>Date</TableCell>{canManage && <TableCell>Actions</TableCell>}
            </TableRow></TableHead>
            <TableBody>{evaluations.map(ev => (
              <TableRow key={ev.id}>
                <TableCell>{ev.evaluationPeriod}</TableCell>
                <TableCell><Chip label={ev.efficiencyScore} color={scoreColor(ev.efficiencyScore) as any} size="small" /></TableCell>
                <TableCell><Chip label={ev.workOutputScore} color={scoreColor(ev.workOutputScore) as any} size="small" /></TableCell>
                <TableCell>{new Date(ev.createdAt).toLocaleDateString()}</TableCell>
                {canManage && <TableCell><Button size="small" onClick={() => setEditEval(ev)}>Edit</Button></TableCell>}
              </TableRow>
            ))}</TableBody>
          </Table>
          {evaluations.length === 0 && <Typography sx={{ p: 2, textAlign: "center", color: "text.secondary" }}>No evaluations found</Typography>}
        </Paper>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Evaluation</DialogTitle>
        <DialogContent><EvaluationForm evaluation={null} employeeId={empId} onClose={() => setCreateOpen(false)} /></DialogContent>
        <DialogActions><Button onClick={() => setCreateOpen(false)}>Cancel</Button></DialogActions>
      </Dialog>

      <Dialog open={!!editEval} onClose={() => setEditEval(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Evaluation</DialogTitle>
        <DialogContent>{editEval && <EvaluationForm evaluation={editEval} employeeId={empId} onClose={() => setEditEval(null)} />}</DialogContent>
        <DialogActions><Button onClick={() => setEditEval(null)}>Cancel</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
