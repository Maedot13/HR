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

function EvaluationForm({ evaluation, employeeId, onClose }: { evaluation: Evaluation | null; employeeId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ evaluationPeriod: evaluation?.evaluationPeriod ?? "", efficiencyScore: evaluation?.efficiencyScore?.toString() ?? "", workOutputScore: evaluation?.workOutputScore?.toString() ?? "" });
  const [error, setError] = useState("");

  const save = useMutation({
    mutationFn: () => evaluation
      ? api.put(`/evaluations/${evaluation.id}`, { ...form, efficiencyScore: Number(form.efficiencyScore), workOutputScore: Number(form.workOutputScore) })
      : api.post(`/employees/${employeeId}/evaluations`, { ...form, efficiencyScore: Number(form.efficiencyScore), workOutputScore: Number(form.workOutputScore) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["evaluations", employeeId] }); onClose(); },
    onError: (e: any) => setError(e.response?.data?.error?.message ?? "Error"),
  });

  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField label="Evaluation Period (e.g. 2025-Q1)" value={form.evaluationPeriod} onChange={e => setForm(p => ({ ...p, evaluationPeriod: e.target.value }))} required />
      <TextField label="Efficiency Score (0–100)" type="number" value={form.efficiencyScore} onChange={e => setForm(p => ({ ...p, efficiencyScore: e.target.value }))} inputProps={{ min: 0, max: 100 }} required />
      <TextField label="Work Output Score (0–100)" type="number" value={form.workOutputScore} onChange={e => setForm(p => ({ ...p, workOutputScore: e.target.value }))} inputProps={{ min: 0, max: 100 }} required />
      <Button variant="contained" onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
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
